//Author Þórður Ágúst Karlsson
//web components: https://open-wc.org/guides/
//stuff: https://modern-web.dev/guides/
import * as utils from "./utils.js";
import {StationSelection} from "./station_selection.js";
import {Plot} from "./plot.js";

function sleep(ms) {
	return new Promise(f => setTimeout(f, ms));
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

	const base_url = window.location.origin;
	const buffer_size = 1440;
	const str_font = "Arial";
	const str_size = 14;

	const plot_container = document.getElementById("plot_container");
	const filter_selection = document.getElementById("filter_selection");
	const ui_plot_scaling_slider = document.getElementById("ui_plot_scaling_slider");
	ui_plot_scaling_slider.value = 1;

	//TODO: error handling!!! HTTP status!!!
	const tremv_config = await fetch(base_url + "/api/current_configuration/", {method: "GET"}).then(function(r) {
		return r.json();
	});

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

		l.setAttribute("for", id);
		l.innerHTML = (tremv_config.filters[i][0].toFixed(1)) + " - " + (tremv_config.filters[i][1].toFixed(1));

		p.appendChild(cb);
		p.appendChild(l);

		filter_selection.appendChild(p);
	}

	const filter_checkboxes = document.getElementsByName(filter_checkbox_group_name);

	const plots = [];
	const station_selection = new StationSelection(tremv_config.stations);

	//initialize plots
	for(let i = 0; i < tremv_config.filters.length; i++) {
		let plot = new Plot(buffer_size, plot_container, tremv_config.stations, station_selection.selected_stations, tremv_config.filters[i], str_font, str_size);
		plot.draw();
		plots.push(plot);
	}

	//TODO: filter checkbox instant og í UI controls en ekki í 

	//Þegar við sækjum gögn gæti verið að loggerinn sé að vinna í gögnunum.
	//Einhverstaðar á milli t og t+1 klárar loggerinn að vinna gögn fyrir t-1 til t og þá er mín t-1 tilbúin.
	//Eina loforðið sem við gefum er að mín t-1 er tilbúin á á t+1 því annars þyrftum við einhvernveginn að láta vita hvenær útreikningarnir eru búnir.
	//Backfill request

	/*
	if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
		let query_string = window.location.search;
		let search_params = new URLSearchParams(query_string);

		if(search_params.has("stations")) {
			let stations = decodeURI(search_params.get("stations")).split(",");

			for(let i = 0; i < stations.length; i++) {
				if(server_stations.includes(stations[i])) {
					addStation(server_stations, selected_stations, station_selection_selector, station_selection_list, stations[i]);
				}
			}

			backfillPlots();
		}
	}
	*/
	
	const station_form = document.querySelector("form");

	station_form.onsubmit = async function(e) {
		e.preventDefault();

		let selected_stations = station_selection.selected_stations;

		//TODO: láta athugun á query params gerast þegar maður ræsir síðuna
		//TODO: include ui settings in query string
		if("URLSearchParams" in window) {//I guess this makes it backwards compfewjfiowejfoiæewjf
			let query_string = window.location.search;
			let search_params = new URLSearchParams(query_string);
			let stations_str = "";

			for(let i = 0; i < selected_stations.length; i++) {
				stations_str += selected_stations[i];
				if(i !== selected_stations.length-1) {
					stations_str += ",";
				}
			}

			search_params.set("stations", stations_str);
			history.pushState(null, "", window.location.pathname + "?" + search_params.toString());
		}

		const two_min = 1000*60*2;
		const range_end = new Date(Date.now() - two_min);
		const day_in_ms = 60*60*24 * 1000;
		const range_start = new Date(range_end - day_in_ms);

		let json_response = await rangeRequest(range_start, range_end, station_selection.selected_stations);
		console.log(json_response);

		let minute_of_day = range_end.getHours() * 60 + range_end.getMinutes();
		for(let i = 0; i < plots.length; i++) plots[i].minute_offset = minute_of_day;

		let filter_indicies = [];

		for(let i = 0; i < json_response.length; i++) {
			let f_str = json_response[i]["filter"].split("-");
			let f = [parseFloat(f_str[0]), parseFloat(f_str[1])];

			for(let j = 0; j < tremv_config.filters.length; j++) {
				if(utils.floatCompare(f[0], tremv_config.filters[j][0]) && utils.floatCompare(f[1], tremv_config.filters[j][1])) {
					filter_indicies.push(j);
					break;
				}
			}
		}

		for(let i = 0; i < filter_indicies.length; i++) {
			let plot = plots[filter_indicies[i]];

			//loop over selected stations
			for(let j = 0; j < selected_stations.length; j++) {
				let station_data = json_response[i]["stations"][selected_stations[j]];

				for(let k = 0; k < station_data.length; k++) {
					plot.addPoint(selected_stations[j], station_data[k]);
				}
			}
		}
	}

	/*
	(async function() {
		console.log("hello");

		console.log("gonna take a lil nap");
		await sleep(3000);
		console.log("feel better after my nap");
	})();
	*/

	//TODO: muna að disable-a UI-ið á meðan það er verið að bíða eftir response...

	//TODO: date_labelið ætti að vera breytanlegt og ættið að fara í plot_title divið(gera fall setDate sem býr til elementið ef það er ekki til, stillir það alltaf)

	/*
	let date_label = document.createElement("div");
	let starttime = new Date();
	date_label.innerHTML = starttime.getDate() + "/" + (starttime.getMonth()+1) + "/" + starttime.getFullYear();
	plots[plots.length-1].title.appendChild(date_label);
	*/

	//TODO:	hvernig er best að framkvæma syncronization hérna? er nógu gott að check-a bara á servernum 30 sek yfir heilu mín? Hvað ef það tekur lengri tíma?
	//		er ekki betra að bíða bara eftir svari?
	//
	//TODO: þarf ekki einhver icon eða eitthvað sem segir að við séum að bíða eftir einhverju?

	//TODO: *	filter selection dótið ætti bara að vera instant og ekki hluti af form submission(getur bara toggle-að það on the fly
	//			(ætti bara að vera partur af UI controls eða eitthvað)
	//		*	Fyrir fastan link gæti ég bara haft "lista" af key value sem er f=True,False,True.... og gefur til kynna hvaða filter-ar eru valdir
	//		*	listinn af stöðvum ætti að birtast fyrir ofan í staðinn fyrir neðan, því textbox elementið stækkar að neðan
	//		*	Laga tíma pop up-ið þannig að það klippist ekki af því frá hægri ef maður er ekki scroll-aður alla leið
	//

})();
