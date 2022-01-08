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

	const plot_container = document.getElementById("plot_container");
	const filter_selection = document.getElementById("filter_selection");
	const ui_plot_scaling_slider = document.getElementById("ui_plot_scaling_slider");
	ui_plot_scaling_slider.value = 1;

	//TODO: error handling!!!
	const tremv_config = await fetch(base_url + "/api/current_configuration/", {method: "GET"}).then(function(r) {
		return r.json();
	});

	console.log(tremv_config);

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

	/*
	let date_label = document.createElement("div");
	let starttime = new Date();
	date_label.innerHTML = starttime.getDate() + "/" + (starttime.getMonth()+1) + "/" + starttime.getFullYear();
	plots[plots.length-1].title.appendChild(date_label);
	*/

})();
