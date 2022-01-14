//TODO: breyta nöfnum
//TODO: ég get bara dynamically búið til hlutinn hér án þess að þetta sé full on web component
//TODO:	það þarf aðeins að fínpússa hvernig listinn birtist. Listinn af völdum stöðvum stækkar alltaf niður þannig drop down listinn
//		færist líka niður sem er pirrandi. Kannski ætti hann bara að birtast fyrir ofan?
export class StationSelection {
	constructor(available_stations) {
		this.selector_div = document.getElementById("station_selection_selector");
		this.list_div = document.getElementById("station_selection_list");
		this.textbox = document.getElementById("station_selection_textbox");
		this.button_all = document.getElementById("station_selection_button_all");
		this.button_none = document.getElementById("station_selection_button_none");
		this.selected_stations = [];
		this.available_stations = available_stations;

		this.generateSelectionList(this.available_stations);

		//so we can access the this pointer for this class inside the events.
		let class_this = this;

		this.textbox.onkeydown = function(e) {
			if(e.code === "Backspace") {
				if(e.target.value === "") {
					class_this.removeStation(class_this.selected_stations.length-1);
				}
			}else if(e.code === "Escape") {
				e.target.value = "";
				class_this.generateSelectionList(class_this.available_stations);
				class_this.list_div.style.display = "none";
				document.activeElement.blur();
			}else if(e.code === "Enter" || e.code === "Space") {
				e.preventDefault();
				if(class_this.addStation(e.target.value)) {
					e.target.value = "";
					class_this.generateSelectionList(class_this.available_stations);
				}
			}
		}

		//Match station names starting with input string and refresh the station list
		this.textbox.oninput = function(e) {
			if(class_this.selected_stations.length === class_this.available_stations.length) {
				class_this.textbox.value = "";
				return;
			}

			let re = new RegExp("^" + e.target.value);
			let matched_stations = [];

			for(let i = 0; i < class_this.available_stations.length; i++) {
				if(re.test(class_this.available_stations[i])) {
					matched_stations.push(class_this.available_stations[i]);
				}
			}

			class_this.generateSelectionList(matched_stations);
		}

		this.textbox.onfocus = function(e) {
			class_this.list_div.style.display = "flex";
			class_this.list_div.scrollTop = 0;
		}

		this.button_all.onclick = function(e) {
			if(class_this.selected_stations.length < class_this.available_stations.length) {
				for(let i = 0; i < class_this.available_stations.length; i++) {
					class_this.addStation(class_this.available_stations[i]);
				}

				class_this.textbox.value = "";
			}
		}

		this.button_none.onclick = function(e) {
			while(class_this.selected_stations.length > 0) {
				class_this.removeStation(class_this.selected_stations.length-1);
			}
		}


		document.onclick = function(e) {
			if(e.target !== class_this.textbox) {
				if(e.target !== class_this.selector_div) {
					if(e.target.classList.contains("station_selection_selectable") == false) {
						class_this.list_div.style.display = "none";
					}
				}
			}
		}
	}

	//framkallar html element með lista af stöðvum sem er hægt að velja úr
	generateSelectionList(stations) {
		while(this.list_div.children.length) {
			this.list_div.removeChild(this.list_div.children[0]);
		}

		for(let i = 0; i < stations.length; i++) {
			let name = stations[i];
			if(this.selected_stations.includes(name) == false) {
				let option = document.createElement("a");
				option.innerHTML = name;
				option.value = name;//NOTE: we might want the innerHTML to be whatever so this is safer
				option.classList.add("station_selection_selectable");

				let class_this = this;

				option.onclick = function(e) {
					if(class_this.addStation(option.value)) {
						class_this.textbox.value = "";
						class_this.generateSelectionList(class_this.available_stations);
					}
				};

				this.list_div.appendChild(option);
			}
		}
	}

	//TODO:láta pilluna vera gráa ef hún er ekki available...
	addStation(str) {
		if(this.available_stations.includes(str)) {
			if(this.selected_stations.includes(str) == false) {
				let element = document.createElement("span");
				element.innerHTML = str;
				element.classList.add("station_selection_tag");

				let class_this = this;

				element.onclick = function(e) {
					let spans = document.getElementsByClassName("station_selection_tag");
					let index = Array.prototype.indexOf.call(spans, e.target);//This is stupid but whatever
					class_this.removeStation(index);
				}

				this.selector_div.appendChild(element);

				this.selected_stations.push(str);

				for(let i = 0; i < this.list_div.children.length; i++) {
					let station = this.list_div.children[i];
					if(station.value === str) {
						this.list_div.removeChild(station);
					}
				}

				return true;
			}
		}

		return false;
	}

	//NOTE: The ordering of the spans should mirror the ordering of the strings in selected_stations
	removeStation(index) {
		if(index >= 0 && index < this.selected_stations.length) {
			if(this.selected_stations.includes(this.selected_stations[index])) {
				let spans = document.getElementsByClassName("station_selection_tag");

				this.selected_stations.splice(index, 1);
				this.selector_div.removeChild(spans[index]);
				this.generateSelectionList(this.available_stations);
			}
		}
	}
}
