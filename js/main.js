//Author Þórður Ágúst Karlsson
//web components: https://open-wc.org/guides/
//stuff: https://modern-web.dev/guides/
import * as utils from "./utils.js";
import {StationSelection} from "./station_selection.js";
import {Plot} from "./plot.js";

(async function() {
	const base_url = window.location.origin;
	const buffer_size = 1440;
	const str_font = "Arial";
	const str_size = 14;
	let date_container = null;
	const plots = [];//heldur utan um plot hluti
	const current_station_selection = [];//afrit af station_selection.selected_stations sem verður til þegar við ýtum á plot takkann
	let live_timeout_id = 0;
	let resize_timeout_id = 0;

	//TODO: error handling!!! HTTP status!!!
	const tremv_config = await fetch(base_url + "/api/current_configuration/", {method: "GET"}).then(function(r) {
		return r.json();
	});

	const station_selection_ui = new StationSelection(tremv_config.stations);

	const plot_container = document.getElementById("plot_container");
	const filter_selection = document.getElementById("filter_selection");
	const ui_plot_scaling_slider = document.getElementById("ui_plot_scaling_slider");
	ui_plot_scaling_slider.value = 1;
	let live_mode = document.getElementById("time_range_live").checked;

	//time range selection UI
	const radio_button_live = document.getElementById("time_range_live");
	const radio_button_past = document.getElementById("time_range_past");
	const datepicker = document.getElementById("datepicker");
	const catalog_checkbox = document.getElementById("catalog_checkbox");

	//initialize plots
	for(const f of tremv_config.filters) {
		let plot = new Plot(buffer_size, plot_container, current_station_selection, f, str_font, str_size);
		plot.draw();
		plots.push(plot);
	}

	const filter_checkbox_group_name = "filter_checkboxes";
	let filter_checkboxes = document.getElementsByName(filter_checkbox_group_name);

	//initialize filter checkboxes
	for(let i = 0; i < tremv_config.filters.length; i++) {
		let p = document.createElement("p");
		let cb = document.createElement("input");
		let l = document.createElement("label");

		let id = "filter_checkbox" + i;
		cb.setAttribute("id", id);
		cb.setAttribute("type", "checkbox");
		cb.setAttribute("name", filter_checkbox_group_name);
		cb.checked = true;

		cb.onchange = function(e) {
			plots[i].setVisibility(cb.checked);

			updateDateLabel();

			let search_params = utils.getURLParams();
			let filter_state = "";

			for(let j = 0; j < filter_checkboxes.length; j++) {
				filter_state += filter_checkboxes[j].checked;
				if(j !== filter_checkboxes.length-1) filter_state += ",";
			}

			search_params.set("filters", filter_state);
			utils.setURLParams(search_params);
		}

		l.setAttribute("for", id);
		l.innerHTML = (tremv_config.filters[i][0].toFixed(1)) + " - " + (tremv_config.filters[i][1].toFixed(1));

		p.appendChild(cb);
		p.appendChild(l);

		filter_selection.appendChild(p);
	}

	//Þegar við sækjum gögn gæti verið að loggerinn sé að vinna í gögnunum.
	//Einhverstaðar á milli t og t+1 klárar loggerinn að vinna gögn fyrir t-1 til t og þá er mín t-1 tilbúin.
	//Eina loforðið sem við gefum er að mín t-1 er tilbúin á á t+1 því annars þyrftum við einhvernveginn að láta vita hvenær útreikningarnir eru búnir.
	//Backfill request

	//show stations from the query string
	if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
		let search_params = utils.getURLParams();

		if(search_params.has("sidebar")) {
			if(search_params.get("sidebar") == "false") {
				hideSidebar();
			}
		}

		if(search_params.has("stations")) {
			let stations = decodeURI(search_params.get("stations")).split(",");

			for(const s of stations) {
				if(tremv_config.stations.includes(s)) {
					station_selection_ui.addStation(s);
					current_station_selection.push(s);
				}
			}

			if(search_params.has("filters")) {
				let filter_state = decodeURI(search_params.get("filters")).split(",");

				for(let i = 0; i < filter_state.length; i++) {
					if(filter_state[i] === "false") {
						plots[i].setVisibility(false);
						filter_checkboxes[i].checked = false;
					}
				}
			}

			if(search_params.has("catalog")) {
				catalog_checkbox.checked = true;
			}

			if(search_params.has("date")) {
				radio_button_past.checked = true;
				clearTimeout(live_timeout_id);

				//TODO: það er óþægilega mikið code duplication í gangi hérna
				//TODO: kannski er þetta live_mode = og datepicker... óþarfi af því ég stilli checked fyrir ofan og þá ætti þetta að tigger-a eventinn?
				datepicker.disabled = false;
				live_mode = false;
				let date = decodeURI(search_params.get("date"));
				datepicker.value = date;

				const range_start = new Date(date);
				const range_end = new Date(range_start.getTime() + utils.daysInMs(1) - 1);
				console.log("start: " + range_start);
				console.log("end: " + range_end);

				//ef dagsetningin er dagurinn í dag byðjum við um backfill en update-um ekki
				if(utils.datesEqual(range_start, new Date())) {
					backfillPlots(current_station_selection);
				}else {
					fillPlots(range_start, range_end, current_station_selection);
				}
			}else {
				backfillPlots(current_station_selection);
				setLiveUpdate();
			}
		}

		setDatepickerMax();
		updateDateLabel();
	}

	//við erum bara að pæla að sækja range sem jafngildir einum degi, því plotting strúktúrinn bíður ekki upp á það eins og er
	async function rangeRequest(range_start, range_end, stations) {
		let json_query = {};
		json_query["stations"] = stations;

		json_query["range_start"] = range_start.toJSON();
		json_query["range_end"] = range_end.toJSON();

		console.log(json_query["range_start"]);
		console.log(json_query["range_end"]);

		const response = await fetch(base_url + "/api/range/",
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json;charset=utf-8'
				},
				body: JSON.stringify(json_query)
			}
		);

		//TODO: error handling!!! HTTP status!!!
		if(response.ok) {
			const range_result = await response.json();
			return range_result;
		}else {
			console.log("HTTP Error " + response.status + ": " + response.statusText);
		}

		return null;
	}

	async function getTriggers(range_start, range_end) {
		let json_query = {};

		json_query["range_start"] = range_start.toJSON();
		json_query["range_end"] = range_end.toJSON();

		console.log("getting catalog from " + range_start + " to " + range_end);

		const response = await fetch(base_url + "/api/catalog_range/",
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json;charset=utf-8'
				},
				body: JSON.stringify(json_query)
			}
		);

		//TODO: error handling!!! HTTP status!!!
		if(response.ok) {
			const result = await response.json();
			return result;
		}else {
			console.log("HTTP Error " + response.status + ": " + response.statusText);
		}

		return null;
	}

	function prepareTriggers(triggers, filter, range_start) {
		if(triggers === null) return null;

		let trigger_table = {};

		for(const t of triggers) {
			//NOTE: ef range_start er stærra en timestamp myndi maður fá rugl index...
			const timestamp = new Date(t["TriggerTime"]);
			if(timestamp >= range_start) {
				const min_of_day = ~~((timestamp - range_start)/utils.minutesInMs(1));

				if(t["Filter"][0] === filter[0] && t["Filter"][1] === filter[1]) {
					trigger_table[min_of_day] = t["Stations"];
				}
			}
		}

		return trigger_table;
	}

	//TODO: disable-a ui á meðan þetta er í gangi
	async function fillPlots(range_start, range_end, stations) {
		let load_container = document.getElementById("load_container");
		load_container.classList.remove("done_loading");
		load_container.classList.add("loading");

		let result = await rangeRequest(range_start, range_end, stations);
		console.log(result);

		let triggers = catalog_checkbox.checked ? await getTriggers(range_start, range_end) : null;

		load_container.classList.remove("loading");
		load_container.classList.add("done_loading");

		//búa til offset þannig að tímalínan er á réttum stað
		let minute_of_end_date = range_end.getHours() * 60 + range_end.getMinutes();

		for(let i = 0; i < plots.length; i++) {
			let p = plots[i];

			p.initBuffers(stations);
			p.minute_offset = minute_of_end_date;

			let station_names_in_result = Object.keys(result[i]["stations"]);

			//loop over selected stations
			for(let j = 0; j < stations.length; j++) {
				let name = stations[j];

				if(station_names_in_result.includes(name)) {
					for(const v of result[i]["stations"][stations[j]]) {
						p.addPoint(stations[j], v);
					}
				}
			}

			let trigger_table = prepareTriggers(triggers, tremv_config.filters[i], range_start);

			//NOTE: þarf að vera trigger fyrir viðeigandi filter
			p.draw(false, trigger_table);
			p.view.scrollLeft = buffer_size;
		}

		//TODO: geta ýtt inn á milli stöðva pillna og fengið textbox þar sem þú getur skrifað eitthvað
	}

	async function backfillPlots(stations) {
		const two_min = utils.minutesInMs(2);
		const range_end = new Date(Date.now() - two_min);
		const range_start = new Date(range_end - utils.daysInMs(1) - 1);

		fillPlots(range_start, range_end, stations);
	}

	async function setLiveUpdate() {
		clearTimeout(live_timeout_id);

		live_timeout_id = setTimeout(async function request() {
			//console.log("updating plot");
			updateDateLabel();

			let json_query = {};
			json_query["stations"] = current_station_selection;

			const response = await fetch(base_url + "/api/latest/",
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json;charset=utf-8'
					},
					body: JSON.stringify(json_query)
				}
			);

			//TODO: error handling!!! HTTP status!!!
			if(response.ok) {
				const result = await response.json();

				for(let i = 0; i < plots.length; i++) {
					for(let j = 0; j < current_station_selection.length; j++) {
						let station = current_station_selection[j];
						plots[i].addPoint(station, result[i]["stations"][station]);
					}
				}

			}else {
				console.log("HTTP Error " + response.status + ": " + response.statusText);

				for(let i = 0; i < plots.length; i++) {
					for(let j = 0; j < current_station_selection.length; j++) {
						let station = current_station_selection[j];
						plots[i].addPoint(station, 0);
					}
				}
			}

			let trigger_range_end = new Date(Date.now() - utils.minutesInMs(2));
			let trigger_range_start = new Date(trigger_range_end - utils.daysInMs(1));
			let triggers = catalog_checkbox.checked ? await getTriggers(trigger_range_start, trigger_range_end) : null;

			for(let i = 0; i < plots.length; i++) {
				let p = plots[i];
				p.minute_offset += 1;

				if(p.minute_offset >= 1440) {
					p.minute_offset = 0;
				}

				let trigger_table = prepareTriggers(triggers, tremv_config.filters[i], trigger_range_start);
				p.draw(false, trigger_table);
			}

			live_timeout_id = setTimeout(request, utils.msToNextMin());
		}, utils.msToNextMin());
	}

	function hideSidebar() {
		document.getElementById("controls").style.display = "none";
		document.getElementById("collapsed_controls").style.display = "block";
		let search_params = utils.getURLParams();
		search_params.set("sidebar", false);
		utils.setURLParams(search_params);
	}

	function showSidebar() {
		document.getElementById("collapsed_controls").style.display = "none";
		document.getElementById("controls").style.display = "block";
		let search_params = utils.getURLParams();
		search_params.set("sidebar", true);
		utils.setURLParams(search_params);
	}

	function setDatepickerMax() {
		const today = new Date();
		const max_year = today.getFullYear().toString();
		const max_month = today.getMonth() + 1;
		const max_day = today.getDate();

		let max_date = max_year + "-";

		if(max_month < 10) max_date += "0";
		max_date += max_month + "-";

		if(max_day < 10) max_date += "0";
		max_date += max_day;

		datepicker.max = max_date;
	}

	function updateDateLabel() {
		if(date_container) date_container.remove();

		let visible_plot = null;

		for(const p of plots) {
			if(p.visible) visible_plot = p;
		}

		date_container = document.createElement("div");
		date_container.id = "date_container";

		let label = document.createElement("div");
		let timestamp = null;

		if(live_mode) {
			let live_icon = document.createElement("div");
			live_icon.classList.add("plot_live");
			date_container.appendChild(live_icon);

			timestamp = new Date();
			setDatepickerMax();
		}else {
			timestamp = new Date(datepicker.value);
		}

		label.innerHTML = timestamp.getDate() + "/" + (timestamp.getMonth()+1) + "/" + timestamp.getFullYear();
		date_container.appendChild(label);

		visible_plot.title.appendChild(date_container);
	}


	//UI Controls
	document.getElementById("hide_button").onclick = function(e) {
		hideSidebar();
	}

	document.getElementById("show_button").onclick = function(e) {
		showSidebar();
	}

	for(const element of document.getElementsByClassName("share_button")) {
		element.onclick = function(e) {
			utils.copyToClipboard(window.location.href);
			alert("Link copied to clipboard!");
		}
	}

	ui_plot_scaling_slider.oninput = function(e) {
		let value = e.target.value;
		for(const plot of plots) {
			plot.updateScaling(value, true);
		}
	}

	ui_plot_scaling_slider.onchange = function(e) {
		let value = e.target.value;
		for(const plot of plots) {
			plot.updateScaling(value);
		}
	}

	document.getElementById("ui_reset_button").onclick = function(e) {
		for(const plot of plots) {
			plot.updateScaling(1);
		}

		ui_plot_scaling_slider.value = 1;
	}

	//TODO: óþægilega mikið code duplication með þetta search param dót
	radio_button_live.onchange = function(e) {
		datepicker.value = "";
		datepicker.disabled = true;
		live_mode = true;

		station_selection_ui.resetAvailableStations(tremv_config.stations);

		let search_params = utils.getURLParams();
		if(search_params.has("date")) {
			search_params.delete("date");
		}

		utils.setURLParams(search_params);
	}

	radio_button_past.onchange = function(e) {
		datepicker.disabled = false;
		live_mode = false;
	}

	catalog_checkbox.onchange = function(e) {
		let search_params = utils.getURLParams();

		if(catalog_checkbox.checked) {
			search_params.set("catalog", true);
		}else {
			if(search_params.has("catalog")) {
				search_params.delete("catalog");
			}

			for(const p of plots) {
				p.cached_triggers = null;
			}
		}

		utils.setURLParams(search_params);
	}

	//það sem ætti eiginlega að gerast hér er að við ættum að varðveita listann sem notandinn var með á meðan onblur er ekki búið að ske,
	//því það gæti verið að notandinn sé að athuga hverjar af þeim stöðvum sem eru núna valdar séu til á þeim dagsetningum sem eru valdar...
	datepicker.onchange = async function(e) {
		//frá mín 0 til síðustu mín dagsins
		const range_start = new Date(e.target.value);
		const range_end = new Date(range_start.getTime() + utils.daysInMs(1));

		let json_query = {};
		json_query["range_start"] = range_start.toJSON();
		json_query["range_end"] = range_end.toJSON();

		const name_response = await fetch(base_url + "/api/stations_in_timerange/",
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json;charset=utf-8'
				},
				body: JSON.stringify(json_query)
			}
		);

		//TODO: error handling!!! HTTP status!!!
		if(name_response.ok) {
			const stations_in_range = await name_response.json();
			station_selection_ui.resetAvailableStations(Object.keys(stations_in_range).sort());
		}else {
			console.log("Failed to get station list..." + name_response.status + ": " + name_response.statusText);
		}

		let search_params = utils.getURLParams();
		search_params.set("date", e.target.value);
		utils.setURLParams(search_params);
	}

	const station_form = document.querySelector("form");

	station_form.onsubmit = async function(e) {
		e.preventDefault();

		while(current_station_selection.length > 0) {
			current_station_selection.pop();
		}

		//Tökum afrit í staðinn fyrir bara reference því við viljum ekki að plotið breytist á meðan við erum að velja stöðvar
		for(const s of station_selection_ui.selected_stations) {
			current_station_selection.push(s);
		}

		//console.log(current_station_selection);

		//add query string for selected stations
		if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
			let search_params = utils.getURLParams();
			let stations_str = current_station_selection.join(",");
			console.log(stations_str);

			search_params.set("stations", stations_str);
			utils.setURLParams(search_params);
		}

		if(live_mode) {
			backfillPlots(current_station_selection);
			setLiveUpdate();
		}else {
			clearTimeout(live_timeout_id);

			const range_start = new Date(datepicker.value);
			const range_end = new Date(range_start.getTime() + utils.daysInMs(1) - 1);

			//ef dagsetningin er dagurinn í dag byðjum við um backfill en update-um ekki
			if(utils.datesEqual(range_start, new Date())) {
				backfillPlots(current_station_selection);
			}else {
				fillPlots(range_start, range_end, current_station_selection);
			}
		}

		updateDateLabel();
	}

	window.onresize = function(e) {
		clearTimeout(resize_timeout_id);

		for(const p of plots) {
			p.draw(true);
		}

		//do a full redraw after a little delay
		resize_timeout_id = setTimeout(function redraw() {
			for(const p of plots) {
				p.draw(false, p.cached_triggers);
			}
		}, 250);
	}

	//		*	listinn af stöðvum ætti að birtast fyrir ofan í staðinn fyrir neðan, því textbox elementið stækkar að neðan
	//		*	Laga tíma pop up-ið þannig að það klippist ekki af því frá hægri ef maður er ekki scroll-aður alla leið
})();
