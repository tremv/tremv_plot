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

	//backfill TODO
	(async function() {
		console.log("gonna take a lil nap");
		await sleep(3000);
		console.log("feel better after my nap");
	})();

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
