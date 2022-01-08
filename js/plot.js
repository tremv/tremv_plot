import * as utils from "./utils.js";

export class Plot {
	//TODO: create reference to the main_station_list object
	constructor(buffer_size, div_container, server_stations, selected_stations, filter, str_font, str_size) {
		this.buffer_size = buffer_size;
		this.data = {};
		this.data_max = {};
		this.data_min = {};
		this.selected_stations = selected_stations;
		this.filter = filter;//Nota þetta reference til að fletta upp indexinu í filters fylkinu
		this.str_font = str_font;
		this.str_size = str_size;

		this.canvas = document.createElement("canvas");
		this.back_canvas = document.createElement("canvas");//create backbuffer
		this.view = document.createElement("div");
		this.title = document.createElement("div");//we might for example need to change the label for the date
		this.visible = true;
		this.minute_offset = 0;
		this.default_min_trace_height = ~~(2160/83); //the min height of an individual station plot. Just based on what they plot in the monitoring room
		this.scaling_factor = 1;

		for(let i = 0; i < server_stations.length; i++) {
			this.data[server_stations[i]] = new utils.RingBuffer(buffer_size);
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
		this.plot_div.appendChild(document.createElement("div"));

		div_container.appendChild(this.plot_div);

		//so you can reference this object from within the event handlers.
		let plot_object = this;

		this.view.onscroll = function(e) {
			plot_object.draw(true);
		}

		this.canvas.onmouseout = function(e) {
			plot_object.draw(true);
		}

		this.canvas.onmousemove = function(e) {
			plot_object.draw(true);
			let context = plot_object.canvas.getContext("2d");
			let x = e.layerX + 0.5;
			utils.drawLine(context, x, 0, x, plot_object.canvas.height, "#000000", 1);
			let square_height = 25;
			let square_width = 50;

			if(e.clientX + square_width > e.target.getBoundingClientRect().right) {
				x -= e.clientX + square_width - e.target.getBoundingClientRect().right;
			}

			utils.drawRect(context, x, e.layerY-square_height, square_width, square_height, "#FFFA64");

			let min_of_day = e.layerX + plot_object.minute_offset;
			if(min_of_day > plot_object.buffer_size) min_of_day -= plot_object.buffer_size;

			let hour = ~~(min_of_day / 60);
			let minute = min_of_day % 60;
			let hour_str = "";
			let minute_str = "";

			if(hour < 10) hour_str += "0";
			if(minute < 10) minute_str += "0";
			hour_str += hour;
			minute_str += minute;
			let text_offset = 7;

			utils.drawText(context, hour_str + ":" + minute_str, x+text_offset, e.layerY-text_offset, plot_object.str_font, plot_object.str_size, "#000000");
		}
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

	//make the trace offset thing a parameter
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

		let width = this.buffer_size;
		//NOTE: clientHeight account for padding but not margin
		let title_div_height = this.title.clientHeight;
		let scrollbar_height = this.view.offsetHeight - this.canvas.clientHeight;

		let grid_top_margin = 30;

		//grid
		let plot_count = station_names.length;
		let trace_height = this.default_min_trace_height;

		let grid_height = trace_height * plot_count;
		let height = grid_height + grid_top_margin;
		let screen_fill_height = window.innerHeight - (scrollbar_height + title_div_height);

		if(screen_fill_height/plot_count > trace_height) {
			height = screen_fill_height;
			grid_height = height - grid_top_margin;
			trace_height = grid_height/plot_count;
		}

		height *= this.scaling_factor;
		grid_height *= this.scaling_factor;
		trace_height *= this.scaling_factor;

		this.canvas.height = height;
		this.canvas.width = width;

		if(draw_cached == false) {
			this.back_canvas.height = height;
			this.back_canvas.width = width;
			
			utils.drawRect(back_context, 0, 0, width, height, "#FFFFFF");

			for(let x = 0; x < width; x++) {
				if((x + this.minute_offset) % 60 == 0) {
					//the ~ operator is a bitwise NOT(meaning all bits will be flipped).
					//A double NOT is a weird way to truncate the float in javascript
					//which is essentially the same as int() in python
					let draw_minute = this.minute_offset + x;
					if(draw_minute >= 60*24) draw_minute -= 60*24;

					let hour = (~~(draw_minute / 60)) % 24;
					let str = "";

					if(hour < 10) str += "0";
					str += hour;

					let text_width = utils.measureTextWidth(back_context, str, this.str_font, this.str_size);
					let text_x = x - text_width/2.0;

					utils.drawText(back_context, str, text_x, height-this.str_size/1.5, this.str_font, this.str_size, "#000000");
				}

				//Because of the way canvas rendering works, the 0.5 is here to get a pixel perfect line 
				let line_x = x + 0.5;
				let grid_y1 = grid_height + 6;

				if((x + this.minute_offset) % 30 == 0) {
					utils.drawLine(back_context, line_x, 0, line_x, grid_y1, "#AAAAAA", 1);
				}else if((x + this.minute_offset) % 10 == 0) {
					utils.drawLine(back_context, line_x, 0, line_x, grid_y1, "#CCEEFF", 1);
				}

				for(let i = 0; i < plot_count; i++) {
					let name = station_names[i];
					let value = 0.0;
					try {
						value = this.data[name].get(x);
					}catch(e) {
						console.log(e + " " + x + ": " + this.data[name].length);
					}

					if(value > 0) {
						value -= this.data_min[name];
						let scale_factor = this.data_max[name] - this.data_min[name];

						let plot_y0 = trace_height * i + trace_height;
						let plot_y1 = plot_y0 - (value/scale_factor * trace_height);

						let color = (i % 2 == 0) ? "#CC4444" : "#44CC44";
						utils.drawLine(back_context, line_x, plot_y0, line_x, plot_y1, color, 1);
						//TODO:	maybe it is possible to optimize this somehow by instead of drawing a white square over everything and then drawing
						//		everything again, to just draw whats in the buffer offset by on pixel and then draw the next column???
					}
				}
			}
		}

		//TODO:	teikna bara þann part sem hefur að geyma plottið, ekki time labelin.
		//		Það er hægt að endurteikna time label-in
		main_context.drawImage(this.back_canvas, 0, 0, width, height);

		//TODO: þarf örugglega að bæta við einhverju margin svo að textinn sé align-aður rétt
		for(let i = 0; i < plot_count; i++) {
			let x = this.view.scrollLeft + 5;
			let y = i * trace_height + this.str_size;
			let width = utils.measureTextWidth(back_context, station_names[i], this.str_font, this.str_size);
			let height = this.str_size;
			utils.drawText(main_context, station_names[i], x, y, this.str_font, this.str_size, "#000000");
		}
	}
}
