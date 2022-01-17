//Author Þórður Ágúst Karlsson
//web components: https://open-wc.org/guides/
//stuff: https://modern-web.dev/guides/
import * as utils from "./utils.js";
import {StationSelection} from "./station_selection.js";
import {Plot} from "./plot.js";

function sleep(ms) {
	return new Promise(f => setTimeout(f, ms));
}

function msToNextMin() {
	let min_in_ms = 1000 * 60;
	let now = Date.now();
	let current_min = ~~(now / min_in_ms);
	let next_min_in_ms = (current_min + 1) * min_in_ms;

	return next_min_in_ms - now;
}

function updatePlotScaling(plots, value, draw_cached=false) {
	for(let i = 0; i < plots.length; i++) {
		plots[i].scaling_factor = value;
		plots[i].draw(draw_cached);
	}
}

(async function() {
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
			console.log("HTTP Error " + request.status + ": " + request.statusText);
		}

		return null;
	}

	//TODO: disable-a ui á meðan þetta er í gangi
	async function backfillPlots(stations, plots) {
		//TODO: láta athugun á query params gerast þegar maður ræsir síðuna
		//TODO: include ui settings in query string
		const two_min = 1000*60*2;
		const range_end = new Date(Date.now() - two_min);
		const day_in_ms = 60*60*24 * 1000;
		const range_start = new Date(range_end - day_in_ms);

		let result = await rangeRequest(range_start, range_end, stations);
		console.log(result);

		//búa til offset þannig að tímalínan er á réttum stað
		let minute_of_day = range_end.getHours() * 60 + range_end.getMinutes();

		for(let i = 0; i < plots.length; i++) {
			plots[i].minute_offset = minute_of_day;
			//loop over selected stations
			for(let j = 0; j < stations.length; j++) {
				let station_data = result[i]["stations"][stations[j]];

				for(let k = 0; k < station_data.length; k++) {
					plots[i].addPoint(stations[j], station_data[k]);
				}
			}
		}

		for(let i = 0; i < plots.length; i++) {
			plots[i].draw();
			plots[i].view.scrollLeft = buffer_size;
		}

		//TODO: geta ýtt inn á milli stöðva pillna og fengið textbox þar sem þú getur skrifað eitthvað
	}

	async function setLiveUpdate() {
		clearTimeout(live_timeout_id);

		live_timeout_id = setTimeout(async function request() {
			console.log(Date.now());

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
				console.log("HTTP Error " + request.status + ": " + request.statusText);

				for(let i = 0; i < plots.length; i++) {
					for(let j = 0; j < current_station_selection.length; j++) {
						let station = current_station_selection[j];
						plots[i].addPoint(station, 0);
					}
				}
			}

			for(let i = 0; i < plots.length; i++) {
				let plot = plots[i];
				plot.minute_offset += 1;

				if(plot.minute_offset >= 1440) {
					plot.minute_offset = 0;
				}

				plot.draw();
			}

			live_timeout_id = setTimeout(request, msToNextMin());
		}, msToNextMin());
	}

	const base_url = window.location.origin;
	const buffer_size = 1440;
	const str_font = "Arial";
	const str_size = 14;

	const plot_container = document.getElementById("plot_container");
	const filter_selection = document.getElementById("filter_selection");
	const ui_plot_scaling_slider = document.getElementById("ui_plot_scaling_slider");
	ui_plot_scaling_slider.value = 1;
	let live_timeout_id = 0;

	//TODO: error handling!!! HTTP status!!!
	const tremv_config = await fetch(base_url + "/api/current_configuration/", {method: "GET"}).then(function(r) {
		return r.json();
	});

	const plots = [];
	const station_selection_ui = new StationSelection(tremv_config.stations);
	const current_station_selection = [];//afrit af station_selection.selected_stations sem verður til þegar við ýtum á plot takkann

	//initialize plots
	for(let i = 0; i < tremv_config.filters.length; i++) {
		let plot = new Plot(buffer_size, plot_container, tremv_config.stations, current_station_selection, tremv_config.filters[i], str_font, str_size);
		plot.draw();
		plots.push(plot);
	}

	const filter_checkbox_group_name = "selected_filter";

	//initialize filter checkboxes
	for(let i = 0; i < tremv_config.filters.length; i++) {
		let p = document.createElement("p");
		let cb = document.createElement("input");
		let l = document.createElement("label");

		//TODO: setja eitthvað on input changes sem breytir plots[i].setVisibility(checked);
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

	//TODO: setja í live mode ef við erum ekki með date request í query strengnum
	//show stations from the query string
	if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
		let query_string = window.location.search;
		let search_params = new URLSearchParams(query_string);

		if(search_params.has("stations")) {
			let stations = decodeURI(search_params.get("stations")).split(",");

			for(let i = 0; i < stations.length; i++) {
				if(tremv_config.stations.includes(stations[i])) {
					station_selection_ui.addStation(stations[i]);
					current_station_selection.push(stations[i]);
				}
			}

			backfillPlots(current_station_selection, plots);
			setLiveUpdate();//TODO: athuga hvort við séum í live mode eða ekki og gera eitthvað byggt á því
		}
	}

	const station_form = document.querySelector("form");

	station_form.onsubmit = async function(e) {
		e.preventDefault();

		while(current_station_selection.length > 0) {
			current_station_selection.pop();
		}

		//Tökum afrit í staðinn fyrir bara reference því við viljum ekki að plotið breytist á meðan við erum að velja stöðvar
		for(let i = 0; i < station_selection_ui.selected_stations.length; i++) {
			console.log("hello");
			current_station_selection.push(station_selection_ui.selected_stations[i]);
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

		backfillPlots(current_station_selection, plots);
		setLiveUpdate();//TODO: athuga hvort við séum í live mode eða ekki og gera eitthvað byggt á því
	}

	ui_plot_scaling_slider.oninput = function(e) {
		let value = e.target.value;
		for(let i = 0; i < plots.length; i++) {
			plots[i].updateScaling(value, true);
		}
	}

	ui_plot_scaling_slider.onchange = function(e) {
		let value = e.target.value;
		for(let i = 0; i < plots.length; i++) {
			plots[i].updateScaling(value);
		}
	}

	document.getElementById("ui_reset_button").onclick = function(e) {
		for(let i = 0; i < plots.length; i++) {
			plots[i].updateScaling(1);
		}
		ui_plot_scaling_slider.value = 1;
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
