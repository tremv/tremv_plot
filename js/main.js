//Author Þórður Ágúst Karlsson
//web components: https://open-wc.org/guides/
//stuff: https://modern-web.dev/guides/
import * as utils from "./utils.js";
import {StationSelection} from "./station_selection.js";
import {Plot} from "./plot.js";

function updatePlotScaling(plots, value, draw_cached=false) {
	for(const p of plots) {
		p.scaling_factor = value;
		p.draw(draw_cached);
	}
}

(async function() {
	const base_url = window.location.origin;
	const buffer_size = 1440;
	const str_font = "Arial";
	const str_size = 14;

	const plot_container = document.getElementById("plot_container");
	const filter_selection = document.getElementById("filter_selection");
	const ui_plot_scaling_slider = document.getElementById("ui_plot_scaling_slider");
	ui_plot_scaling_slider.value = 1;
	let live_timeout_id = 0;
	let live_mode = document.getElementById("time_range_live").checked;

	const plots = [];//heldur utan um plot hluti

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

	//TODO: disable-a ui á meðan þetta er í gangi
	async function fillPlots(range_start, range_end, stations) {
		let result = await rangeRequest(range_start, range_end, stations);
		console.log(result);

		//búa til offset þannig að tímalínan er á réttum stað
		let minute_of_day = range_end.getHours() * 60 + range_end.getMinutes();

		for(let i = 0; i < plots.length; i++) {
			let p = plots[i];

			p.initBuffers(stations);
			p.minute_offset = minute_of_day;

			let station_names_in_result = Object.keys(result[i]["stations"])

			//loop over selected stations
			for(let j = 0; j < stations.length; j++) {
				let name = stations[j];

				if(station_names_in_result.includes(name)) {
					for(const v of result[i]["stations"][stations[j]]) {
						p.addPoint(stations[j], v);
					}
				}
			}
		}

		for(const p of plots) {
			p.draw();
			p.view.scrollLeft = buffer_size;
		}

		//TODO: geta ýtt inn á milli stöðva pillna og fengið textbox þar sem þú getur skrifað eitthvað
	}

	async function backfillPlots(stations) {
		const two_min = utils.minutesInMs(2);
		const range_end = new Date(Date.now() - two_min);
		const range_start = new Date(range_end - utils.daysInMs(1));

		fillPlots(range_start, range_end, stations);
	}

	async function setLiveUpdate() {
		clearTimeout(live_timeout_id);

		live_timeout_id = setTimeout(async function request() {
			console.log(new Date());

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

			for(const p of plots) {
				p.minute_offset += 1;

				if(p.minute_offset >= 1440) {
					p.minute_offset = 0;
				}

				p.draw();
			}

			live_timeout_id = setTimeout(request, utils.msToNextMin());
		}, utils.msToNextMin());
	}


	//INITIALIZATION BEGINS HERE

	//TODO: error handling!!! HTTP status!!!
	const tremv_config = await fetch(base_url + "/api/current_configuration/", {method: "GET"}).then(function(r) {
		return r.json();
	});

	const station_selection_ui = new StationSelection(tremv_config.stations);
	//NOTE: þurfum að hafa reference hér í listan því live update þarf hann
	const current_station_selection = [];//afrit af station_selection.selected_stations sem verður til þegar við ýtum á plot takkann

	//initialize plots
	for(const f of tremv_config.filters) {
		let plot = new Plot(buffer_size, plot_container, current_station_selection, f, str_font, str_size);
		plot.draw();
		plots.push(plot);
	}

	const filter_checkbox_group_name = "selected_filter";

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

	//TODO: ef við með date="isodate" í query param ættum við að fara að skoða ákveðna dagsetningu
	//show stations from the query string
	if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
		let query_string = window.location.search;
		let search_params = new URLSearchParams(query_string);

		if(search_params.has("stations")) {
			let stations = decodeURI(search_params.get("stations")).split(",");

			for(const s of stations) {
				if(tremv_config.stations.includes(s)) {
					station_selection_ui.addStation(s);
					current_station_selection.push(s);
				}
			}

			backfillPlots(current_station_selection);
			setLiveUpdate();//TODO: athuga hvort við séum í live mode eða ekki og gera eitthvað byggt á því
		}
	}

	//UI Controls
	document.getElementById("hide_button").onclick = function(e) {
		document.getElementById("controls").style.display = "none";
		document.getElementById("collapsed_controls").style.display = "block";
	}

	document.getElementById("show_button").onclick = function(e) {
		document.getElementById("collapsed_controls").style.display = "none";
		document.getElementById("controls").style.display = "block";
	}

	for(const element of document.getElementsByClassName("share_button")) {
		element.onclick = function(e) {
			console.log(window.location);
			if("clipboard" in navigator) {
				navigator.clipboard.writeText(window.location);
				alert("Link copied to clipboard!");
			}else {
				alert("No HTTPS :(");
			}
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


	//time range selection UI
	const radio_button_live = document.getElementById("time_range_live");
	const radio_button_past = document.getElementById("time_range_past");
	const datepicker = document.getElementById("datepicker");
	const yesterday = new Date(new Date().getTime() - utils.daysInMs(1));

	const max_year = yesterday.getFullYear().toString();
	const max_month = yesterday.getMonth() + 1;
	const max_day = yesterday.getDate();

	let max_date = max_year + "-";

	if(max_month < 10) max_date += "0";
	max_date += max_month + "-";

	if(max_day < 10) max_date += "0";
	max_date += max_day;

	datepicker.max = max_date;

	radio_button_live.onchange = function(e) {
		datepicker.value = "";
		datepicker.disabled = true;
		live_mode = true;
	}

	radio_button_past.onchange = function(e) {
		datepicker.disabled = false;
		live_mode = false;
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

		console.log(current_station_selection);

		if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
			let query_string = window.location.search;
			let search_params = new URLSearchParams(query_string);
			let stations_str = "";

			for(let i = 0; i < current_station_selection.length; i++) {
				stations_str += current_station_selection[i];
				if(i !== current_station_selection.length-1) {
					stations_str += ",";
				}
			}

			search_params.set("stations", stations_str);
			history.pushState(null, "", window.location.pathname + "?" + search_params.toString());
		}

		if(live_mode) {
			backfillPlots(current_station_selection);
			setLiveUpdate();//TODO: athuga hvort við séum í live mode eða ekki og gera eitthvað byggt á því
		}else {
			clearTimeout(live_timeout_id);

			const range_start = new Date(datepicker.value);
			const range_end = new Date(range_start.getTime() + utils.minutesInMs(1439));

			fillPlots(range_start, range_end, current_station_selection);
		}
	}


	//TODO: muna að disable-a UI-ið á meðan það er verið að bíða eftir response...

	//TODO: date_labelið ætti að vera breytanlegt og ættið að fara í plot_title divið(gera fall setDate sem býr til elementið ef það er ekki til, stillir það alltaf)

	/*
	let date_label = document.createElement("div");
	let starttime = new Date();
	date_label.innerHTML = starttime.getDate() + "/" + (starttime.getMonth()+1) + "/" + starttime.getFullYear();
	plots[plots.length-1].title.appendChild(date_label);
	*/

	//TODO: þarf ekki einhver icon eða eitthvað sem segir að við séum að bíða eftir einhverju?

	//		*	Fyrir fastan link gæti ég bara haft "lista" af key value sem er f=True,False,True.... og gefur til kynna hvaða filter-ar eru valdir
	//		*	listinn af stöðvum ætti að birtast fyrir ofan í staðinn fyrir neðan, því textbox elementið stækkar að neðan
	//		*	Laga tíma pop up-ið þannig að það klippist ekki af því frá hægri ef maður er ekki scroll-aður alla leið
	//

})();
