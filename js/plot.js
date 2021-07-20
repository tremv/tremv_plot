//Author Þórður Ágúst Karlsson
//
//TODO: correct time labels
(async function() {

	//credit: bergur snorrason
	function floatCompare(x, y) {
		let eps = 1e-9;
		return (Math.abs(x - y) < eps);
	}

	class RingBuffer {
		constructor(size) {
			this.size = size;
			this.data = new Array(size);
			this.start = 0;
			this.length = 0;
		}

		push(e) {
			let index = this.start + this.length;
			if(index >= this.size) {
				index -= this.size;
			}

			this.data[index] = e;

			if(this.length < this.size) {
				this.length++;
			}else {
				this.start++;
				if(this.start > this.size) {
					this.start = 0;
				}
			}
		}

		pop() {
			if(this.length <= 0) throw "Buffer is empty!";
			let result = this.get(this.length-1);
			this.length--;
			return result;
		}

		get(i) {
			if(this.length == 0) return null;
			if(i > this.length || i < 0) {
				throw "index out of range!";
			}

			let true_index = this.start + i;
			if(true_index >= this.size) {
				true_index -= this.size;
			}

			return this.data[true_index];
		}

		set(i, value) {
			if(i > this.length || i < 0) {
				throw "index out of range!";
			}

			let true_index = this.start + i;
			if(true_index >= this.size) {
				true_index -= this.size;
			}

			this.data[true_index] = value;
		}
	}

	//drawing functions
	function drawLine(context, x0, y0, x1, y1, color, width) {
		let prev_stroke_color = context.strokeStyle;
		let prev_stroke_width = context.lineWidth;

		context.beginPath();
		context.strokeStyle = color;
		context.lineWidth = width;
		context.moveTo(x0, y0);
		context.lineTo(x1, y1);
		context.stroke();

		context.strokeStyle = prev_stroke_color;
		context.lineWidth = prev_stroke_width;
	}
	
	function drawRect(context, x, y, width, height, color) {
		let prev_color = context.fillStyle;
		context.fillStyle = color;
		context.fillRect(x, y, width, height);
		context.fillStyle = prev_color;
	}

	function drawText(context, text, x, y, font, size, color) {
		let prev_font = context.font;
		let prev_color = context.fillStyle;

		context.font = size.toString() + "px " + font;
		context.fillStyle = color;
		context.fillText(text, x, y);

		context.font = prev_font;
		context.fillStyle = prev_color;
	}

	function measureTextWidth(context, text, font, size) {
		let result = 0.0;
		let prev_font = context.font;

		context.font = size.toString() + "px " + font;
		result = context.measureText(text).width;
		context.font = prev_font;

		return result;
	}

	class Plot {
		//TODO: create reference to the main_station_list object
		constructor(buffer_size, div_container, server_stations, selected_stations, filter) {
			this.buffer_size = buffer_size;
			this.data = {};
			this.data_max = {};
			this.data_min = {};
			this.filter = filter;//Nota þetta reference til að fletta upp indexinu í filters fylkinu
			this.selected_stations = selected_stations;
			this.canvas = document.createElement("canvas");
			this.back_canvas = document.createElement("canvas");//create backbuffer
			this.view = document.createElement("div");
			this.title = document.createElement("div");//we might for example need to change the label for the date
			this.visible = true;
			this.minute_offset = 0;

			for(let i = 0; i < server_stations.length; i++) {
				this.data[server_stations[i]] = new RingBuffer(buffer_size);
				this.data_max[server_stations[i]] = 0;
				this.data_min[server_stations[i]] = 1 << 30;//just some sufficiently high number we never expect
			}

			this.view.classList.add("plot_view");
			this.view.appendChild(this.canvas);

			this.title.classList.add("plot_title");
			let filter_label = document.createElement("div");
			filter_label.innerHTML = filter[0].toFixed(1) + " - " + filter[1].toFixed(1) + "Hz";
			this.title.appendChild(filter_label);

			this.plot_div = document.createElement("div");
			this.plot_div.classList.add("plot");

			this.plot_div.appendChild(this.title);
			this.plot_div.appendChild(this.view);

			div_container.appendChild(this.plot_div);
		}

		setVisibility(visible) {
			this.visible = visible;

			if(visible) {
				this.plot_div.style.display = "block";
			}else {
				this.plot_div.style.display = "none";
			}
		}

		//TODO: increment minute_of_day value
		addPoint(station_name, value) {
			let value_abs = Math.abs(value);
			this.data[station_name].push(value_abs);
			this.minute_offset++;
			if(this.minute_offset == this.buffer_size) this.minute_offset = 0;

			//TODO: Math.abs?
			if(value_abs > this.data_max[station_name]) this.data_max[station_name] = value_abs;
			if(value_abs < this.data_min[station_name]) {
				if(value_abs > 0.0) this.data_min[station_name] = value_abs;
			}
		}

		//TODO: 
		//	*	Re-render if the page dimnesions change and stuff
		//	*	Display time a line where the cursor is and show the time next to it
		//	*	Express the width of the canvas as a ratio of the page size, so something like 70% or something
		//	*	When we scroll, the text should follow. The plot could be written to a seperate buffer,
		//		and then we could just write from it to the backbuffer and then draw the text...
		//	*	Cut image from the left to the position of the scroll bar, so we don't get a scuffed image
		//		when we open it in a new tab
		//when station data is null, we just draw the image again

		draw(draw_cached=false) {
			if(this.visibile == false) return;
			//https://www.html5rocks.com/en/tutorials/canvas/hidpi/
			//https://stackoverflow.com/questions/40066166/canvas-text-rendering-blurry
			//https://stackoverflow.com/questions/8028864/using-nearest-neighbor-with-css-zoom-on-canvas-and-img
			/*
			context.canvas.height = context.canvas.clientHeight*2;
			context.canvas.width = context.canvas.clientWidth*2;
			context.scale(2,2);
			*/
			let station_names = this.selected_stations;
			let main_context = this.canvas.getContext("2d");
			let back_context = this.back_canvas.getContext("2d");

			let width = buffer_size;
			//NOTE: clientHeight account for padding but not margin
			let title_div_height = this.title.clientHeight;
			let scrollbar_height = this.view.offsetHeight - this.canvas.clientHeight;

			let height = window.innerHeight - (scrollbar_height + title_div_height);
			this.canvas.height = height;
			this.canvas.width = width;

			//grid
			let grid_height = height - 30;
			let plot_count = station_names.length;
			let plot_height = grid_height/plot_count;

			if(draw_cached == false) {
				this.back_canvas.height = height;
				this.back_canvas.width = width;
				
				drawRect(back_context, 0, 0, width, height, "#FFFFFF");

				for(let x = 0; x < width; x++) {
					if(x % 60 == 0) {
						//the ~ operator is a bitwise NOT(meaning all bits will be flipped).
						//A double NOT is a weird way to truncate the float in javascript
						//which is essentially the same as int() in python
						let hour = (~~(x / 60)) % 24;
						let str = "";

						if(hour < 10) str += "0";
						str += hour;

						let text_width = measureTextWidth(back_context, str, str_font, str_size);
						let text_x = x - text_width/2.0;

						drawText(back_context, str, text_x, height-str_size/1.5, str_font, str_size, "#000000");
					}

					//Because of the way canvas rendering works, the 0.5 is here to get a pixel perfect line 
					let line_x = x + 0.5;
					let grid_y1 = grid_height + 6;

					if(x % 30 == 0) {
						drawLine(back_context, line_x, 0, line_x, grid_y1, "#AAAAAA", 1);
					}else if(x % 10 == 0) {
						drawLine(back_context, line_x, 0, line_x, grid_y1, "#CCEEFF", 1);
					}

					for(let i = 0; i < plot_count; i++) {
						let name = station_names[i];
						let value = this.data[name].get(x);

						if(value > 0) {
							value -= this.data_min[name];
							let scale_factor = this.data_max[name] - this.data_min[name];

							let plot_y0 = plot_height * i + plot_height;
							let plot_y1 = plot_y0 - (value/scale_factor * plot_height);

							let color = (i % 2 == 0) ? "#CC4444" : "#44CC44";
							drawLine(back_context, line_x, plot_y0, line_x, plot_y1, color, 1);
							//TODO:	maybe it is possible to optimize this somehow by instead of drawing a white square over everything and then drawing
							//		everything again, to just draw whats in the buffer offset by on pixel and then draw the next column???
						}
					}
				}

				console.log("Plot updated.");
			}

			main_context.drawImage(this.back_canvas, 0, 0, width, height);

			for(let i = 0; i < plot_count; i++) {
				let x = this.view.scrollLeft + 5;
				let y = i * plot_height + plot_height/3;
				let width = measureTextWidth(back_context, station_names[i], str_font, str_size);
				let height = str_size;
				drawText(main_context, station_names[i], x, y, str_font, str_size, "#000000");
			}
		}
	}


	//station selection functions
	function generateSelectionList(server_stations, selected_stations, selector_div, list_div) {
		while(list_div.children.length) {
			list_div.removeChild(list_div.children[0]);
		}

		for(let i = 0; i < server_stations.length; i++) {
			let name = server_stations[i];
			if(selected_stations.includes(name) == false) {
				let option = document.createElement("a");
				option.innerHTML = name;
				option.value = name;//NOTE: we might want the innerHTML to be whatever so this is safer
				option.classList.add("station_selection_selectable");
				option.onclick = function() {
					addStation(server_stations, selected_stations, selector_div, list_div, option.innerHTML);
					station_selection_textbox.value = "";
				};

				list_div.appendChild(option);
			}
		}
	}

	function addStation(server_stations, selected_stations, selector_div, list_div, str) {
		if(server_stations.includes(str)) {
			if(selected_stations.includes(str) == false) {
				let e = document.createElement("span");
				e.innerHTML = str;
				e.classList.add("station_selection_tag");

				e.onclick = function(e) {
					let spans = document.getElementsByClassName("station_selection_tag");
					let index = Array.prototype.indexOf.call(spans, e.target);//This is stupid but whatever
					removeStation(server_stations, selected_stations, selector_div, list_div, index);
				}

				selector_div.appendChild(e);

				selected_stations.push(str);

				for(let i = 0; i < list_div.children.length; i++) {
					let station = list_div.children[i];
					if(station.value === str) {
						list_div.removeChild(station);
					}
				}

				return true;
			}
		}

		return false;
	}

	//NOTE: The ordering of the spans should mirror the ordering of the strings in selected_stations
	function removeStation(server_stations, selected_stations, selector_div, list_div, index) {
		if(index >= 0 && index < selected_stations.length) {
			if(selected_stations.includes(selected_stations[index])) {
				let spans = document.getElementsByClassName("station_selection_tag");

				selected_stations.splice(index, 1);
				station_selection_selector.removeChild(spans[index]);
				generateSelectionList(server_stations, selected_stations, selector_div, list_div);
			}
		}
	}

	//initialization stuff
	const station_selection_selector = document.getElementById("station_selection_selector");
	const station_selection_list = document.getElementById("station_selection_list");
	const station_selection_textbox = document.getElementById("station_selection_textbox");
	const station_selection_button_all = document.getElementById("station_selection_button_all");
	const station_selection_button_none = document.getElementById("station_selection_button_none");
	const filter_checkbox_group_name = "selected_filter";

	const buffer_size = 1440;
	const str_font = "Arial";
	const str_size = 14;
	const base_url = window.location.origin;

	const metadata = await fetch(base_url + "/api/metadata/", {method: "GET"}).then(function(r) {
		return r.json();
	});

	const selected_stations = [];
	const server_stations = metadata.station_names;
	const filters = metadata.filters;

	const filter_selection = document.getElementById("filter_selection");
	const plot_container = document.getElementById("plot_container");
	const plots = [];

	//initialize filter checkboxes
	for(let i = 0; i < filters.length; i++) {
		let p = document.createElement("p");
		let cb = document.createElement("input");
		let l = document.createElement("label");

		let id = "filter_checkbox" + i;
		cb.setAttribute("id", id);
		cb.setAttribute("type", "checkbox");
		cb.setAttribute("name", filter_checkbox_group_name);

		l.setAttribute("for", id);
		l.innerHTML = (filters[i][0].toFixed(1)) + " - " + (filters[i][1].toFixed(1));

		p.appendChild(cb);
		p.appendChild(l);

		filter_selection.appendChild(p);
	}

	const filter_checkboxes = document.getElementsByName(filter_checkbox_group_name);
	//TODO: date label!
	/*
	let date_label = document.createElement("div");
	date_label.innerHTML = range_end.getDay() + "/" + range_end.getMonth() + "/" + range_end.getFullYear();
	plots[plots.length-1].title.appendChild(date_label);
	*/

	generateSelectionList(server_stations, selected_stations, station_selection_selector, station_selection_list);

	station_selection_textbox.onkeydown = function(e) {
		if(e.code === "Backspace") {
			if(e.target.value === "") {
				removeStation(server_stations, selected_stations, station_selection_selector, station_selection_list, selected_stations.length-1);
			}
		}else {
			if(e.code === "Enter" || e.code === "Space") {
				e.preventDefault();
				if(addStation(server_stations, selected_stations, station_selection_selector, station_selection_list, e.target.value)) {
					e.target.value = "";
				}
			}
		}
	}

	station_selection_textbox.oninput = function(e) {
		let re = new RegExp(e.target.value);
		let matched_stations = [];

		for(let i = 0; i < server_stations.length; i++) {
			if(re.test(server_stations[i])) {
				matched_stations.push(server_stations[i]);
			}
		}

		generateSelectionList(matched_stations, selected_stations, station_selection_selector, station_selection_list);
	}

	station_selection_button_all.onclick = function(e) {
		if(selected_stations.length < server_stations.length) {
			for(let i = 0; i < server_stations.length; i++) {
				addStation(server_stations, selected_stations, station_selection_selector, station_selection_list, server_stations[i]);
			}
		}
	}

	station_selection_button_none.onclick = function(e) {
		while(selected_stations.length > 0) {
			removeStation(server_stations, selected_stations, station_selection_selector, station_selection_list, selected_stations.length-1);
		}
	}

	document.onclick = function(e) {
		if(e.target !== station_selection_textbox) {
			if(e.target !== station_selection_selector) {
				if(e.target.classList.contains("station_selection_selectable") == false) {
					station_selection_list.style.display = "none";
				}
			}
		}
	}

	station_selection_textbox.onfocus = function(e) {
		station_selection_list.style.display = "flex";
		station_selection_list.scrollTop = 0;
	}

	for(let i = 0; i < filters.length; i++) {
		let plot = new Plot(buffer_size, plot_container, server_stations, selected_stations, filters[i]);

		//TODO: maybe there is a better way to do this
		plot.view.onscroll = function(e) {
			plot.draw(true);
		}

		plots.push(plot);
	}

	//part of initialization
	for(let i = 0; i < plots.length; i++) {
		plots[i].draw();
	}

	const form = document.querySelector("form");

	form.onsubmit = async function(e) {
		e.preventDefault();

		//TODO: some of this stuff shouldn't be const because we might add or remove filters etc. on the fly
		const range_end = new Date(Date.now() - 1000*60);//get the current timestamp minus 1 min
		const day_in_msec = 60*60*24 * 1000;
		const range_start = new Date(range_end - day_in_msec);
		let no_check = true;

		let minute_of_day = range_end.getHours() * 60 + range_end.getMinutes();

		for(let i = 0; i < plots.length; i++) {
			plots[i].minute_offset = minute_of_day;
		}

		query = {};
		query["filters"] = [];

		for(let i = 0; i < filter_checkboxes.length; i++) {
			let checked = filter_checkboxes[i].checked;
			if(checked) {
				query["filters"].push(filters[i]);
				no_check = false;
			}

			plots[i].setVisibility(checked);
		}

		if(no_check) {
			let checkbox = filter_checkboxes[filter_checkboxes.length-1];
			checkbox.setCustomValidity("You must select at least one checkbox!");
			checkbox.reportValidity();
			checkbox.setCustomValidity("");
			return;
		}

		query["station_names"] = selected_stations;//TODO: this should be like the selected list
		query["do_log_transform"] = true;

		console.log(range_start);
		console.log(range_end);

		query["rangestart"] = {
			year: range_start.getFullYear(),
			month: range_start.getMonth()+1,
			day: range_start.getDate()
		};

		query["rangestart"]["hour"] = range_start.getHours();
		query["rangestart"]["minute"] = range_start.getMinutes();

		query["rangeend"] = {
			year: range_end.getFullYear(),
			month: range_end.getMonth()+1,
			day: range_end.getDate()
		};

		query["rangeend"]["hour"] = range_end.getHours();
		query["rangeend"]["minute"] = range_end.getMinutes();

		console.log("before post");
		const range_response = await fetch(base_url + "/api/range/", 
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(query)
			}
		);

		const range_json = await range_response.json();
		console.log("after post");

		let filter_indicies = [];

		for(let i = 0; i < query["filters"].length; i++) {
			let f = query["filters"][i];

			for(let j = 0; j < filters.length; j++) {
				if(floatCompare(f[0], filters[j][0]) && floatCompare(f[1], filters[j][1])) {
					filter_indicies.push(j);
					break;
				}
			}
		}

		for(let i = 0; i < filter_indicies.length; i++) {
			let plot = plots[filter_indicies[i]];

			//loop over selected stations
			for(let j = 0; j < selected_stations.length; j++) {
				let station_data = range_json["data"][i]["stations"][selected_stations[j]];

				for(let k = 0; k < station_data.length; k++) {
					plot.addPoint(selected_stations[j], station_data[k]);
				}
			}
		}

		for(let i = 0; i < plots.length; i++) {
			plots[i].draw();
		}

		for(let i = 0; i < plots.length; i++) {
			plots[i].view.scrollLeft = buffer_size;
		}
	}


	//render plot to buffer and re render the text on top
	/*
	setInterval(async function() {
		let selected_filters = [];

		for(let i = 0; i < filter_checkboxes.length; i++) {
			let checked = filter_checkboxes[i].checked;
			if(checked) {
				selected_filters.push(filters[i]);
			}

			plots[i].setVisibility(checked);
		}

		query = {};
		query["station_names"] = server_stations;
		query["filters"] = filters;
		query["do_log_transform"] = true;

		const latest_data = await fetch(base_url + "/api/latest/", 
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(query)
			}
		).then(function(r) {
			return r.json();
		});

		for(let i = 0; i < plots.length; i++) {
			for(let j = 0; j < server_stations.length; j++) {
				let value = 0.0;

				if(latest_data) {
					value = latest_data["data"][i]["stations"][server_stations[j]];
				}

				plots[i].addPoint(server_stations[j], value);
			}
		}

		for(let i = 0; i < plots.length; i++) {
			plots[i].draw();
		}
	}, 1000 * 60);
	*/

	document.onkeydown = function(e) {
		if(e.code === "Enter") {
			for(let i = 0; i < plots.length; i++) {
				plots[i].draw();
			}
		}
	}

	window.onresize = function(e) {
		for(let i = 0; i < plots.length; i++) {
			plots[i].draw(true);
		}
	}
})();
