//Author Þórður Ágúst Karlsson
//
//TODO: correct time labels
(async function() {
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

	class Plot {
		//TODO: create reference to the main_station_list object
		constructor(div_container, filter) {
			this.data = {};
			this.filter = filter;//Nota þetta reference til að fletta upp indexinu í filters fylkinu
			this.canvas = document.createElement("canvas");
			this.back_canvas = document.createElement("canvas");//create backbuffer
			this.div = document.createElement("div");

			this.div.classList.add("plot");
			this.div.appendChild(this.canvas);
			div_container.appendChild(this.div);
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
			//https://www.html5rocks.com/en/tutorials/canvas/hidpi/
			//https://stackoverflow.com/questions/40066166/canvas-text-rendering-blurry
			//https://stackoverflow.com/questions/8028864/using-nearest-neighbor-with-css-zoom-on-canvas-and-img
			/*
			context.canvas.height = context.canvas.clientHeight*2;
			context.canvas.width = context.canvas.clientWidth*2;
			context.scale(2,2);
			*/
			let station_names = Object.keys(this.data);
			let main_context = this.canvas.getContext("2d");
			let back_context = this.back_canvas.getContext("2d");

			let width = buffer_size;
			let height = window.innerHeight-20;//20 is some arbritrary value to account for the scrollbar at the bottom??

			this.canvas.height = height;
			this.canvas.width = width;

			//grid
			let grid_height = height - 30;
			//TODO: create a union of this list and station_list(so that we draw nothing where we have no data)
			let plot_count = station_names.length;
			let plot_height = grid_height/plot_count;

			if(draw_cached == false) {
				this.back_canvas.height = height;
				this.back_canvas.width = width;
				
				let station_maxes = [];
				let station_mins = [];

				for(let i = 0; i < plot_count; i++) {
					let plot_max = 0;
					let plot_min = 1 << 30;

					for(let j = 0; j < buffer_size; j++) {
						let value = Math.abs(this.data[station_names[i]].get(j));
						if(value > plot_max) {
							plot_max = value;
						}

						if(value < plot_min) {
							if(value > 0.0) {
								plot_min = value;
							}
						}
					}

					station_maxes.push(plot_max);
					station_mins.push(plot_min);
				}

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
						let value = Math.abs(this.data[station_names[i]].get(x));
						if(value > 0) {
							value -= station_mins[i];
							let scale_factor = station_maxes[i] - station_mins[i];

							let plot_y0 = plot_height * i + plot_height;
							let plot_y1 = plot_y0 - (value/scale_factor * plot_height);

							let color = (i % 2 == 0) ? "#CC4444" : "#44CC44";
							drawLine(back_context, line_x, plot_y0, line_x, plot_y1, color, 1);
						}
					}
				}

				console.log("Plot updated.");
			}

			main_context.drawImage(this.back_canvas, 0, 0, width, height);

			for(let i = 0; i < plot_count; i++) {
				let x = this.div.scrollLeft + 5;
				let y = i * plot_height + plot_height/3;
				let width = measureTextWidth(back_context, station_names[i], str_font, str_size);
				let height = str_size;
				drawText(main_context, station_names[i], x, y, str_font, str_size, "#000000");
			}
		}
	}

	const buffer_size = 1440;
	const str_font = "Arial";
	const str_size = 14;
	const base_url = window.location.origin;

	//TODO: some of this stuff shouldn't be const because we might add or remove filters etc. on the fly
	const init_range_end = new Date(Date.now() - 1000*60);//get the current timestamp minus 1 min
	const day_in_msec = 60*60*24 * 1000;
	const init_range_start = new Date(init_range_end - day_in_msec);

	const metadata = await fetch(base_url + "/api/metadata/", {method: "GET"}).then(function(r) {
		return r.json();
	});

	//const station_list = ["gri", "hrn", "sig", "hla", "gra", "lei", "bre", "hed", "gil", "dim", "ski", "gha", "kvo", "ren", "mel", "grs", "sva"];
	//const filters = [[1.0, 2.0]];
	console.log(metadata);
	const station_list = metadata.station_names.slice(0, ~~(metadata.station_names.length/3));
	const filters = metadata.filters;

	const plot_container = document.getElementById("plot_container");
	const plots = [];

	//TODO: this will probably change at runtime if you add stations and stuff
	for(let i = 0; i < filters.length; i++) {
		let plot = new Plot(plot_container, filters[i]);

		//TODO: maybe there is a better way to do this
		plot.div.onscroll = function(e) {
			plot.draw(true);
		}

		//TODO: do in constructor
		for(let j = 0; j < station_list.length; j++) {
			plot.data[station_list[j]] = new RingBuffer(buffer_size);
		}

		plots.push(plot);
	}

	init_query = {};
	init_query["filters"] = filters;
	init_query["station_names"] = station_list;//TODO: this should be like the selected list
	init_query["do_log_transform"] = true;

	console.log(init_range_start);
	console.log(init_range_end);

	init_query["rangestart"] = {
		year: init_range_start.getFullYear(),
		month: init_range_start.getMonth()+1,
		day: init_range_start.getDate()
	};

	init_query["rangestart"]["hour"] = init_range_start.getHours();
	init_query["rangestart"]["minute"] = init_range_start.getMinutes();

	init_query["rangeend"] = {
		year: init_range_end.getFullYear(),
		month: init_range_end.getMonth()+1,
		day: init_range_end.getDate()
	};

	init_query["rangeend"]["hour"] = init_range_end.getHours();
	init_query["rangeend"]["minute"] = init_range_end.getMinutes();

	console.log("before post");
	const init_response = await fetch(base_url + "/api/range/", 
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(init_query)
		}
	);

	const init_json = await init_response.json();
	console.log("after post");

	//TODO: need to do some corrspondances between the filters in the json object and the once that are local
	for(let i = 0; i < plots.length; i++) {
		let plot = plots[i];
	
		for(let j = 0; j < Object.keys(plot.data).length; j++) {
			let station_data = init_json["data"][i]["stations"][station_list[j]];

			for(let k = 0; k < station_data.length; k++) {
				plot.data[station_list[j]].push(station_data[k]);
			}
		}
	}

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


	for(let i = 0; i < plots.length; i++) {
		plots[i].draw();
	}

	for(let i = 0; i < plots.length; i++) {
		plots[i].div.scrollLeft = buffer_size;
	}

	//render plot to buffer and re render the text on top
	setInterval(async function() {
		query = {};
		query["station_names"] = station_list;
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

		for(let i = 0; i < station_list.length; i++) {
			for(let j = 0; j < plots.length; j++) {
				//TODO: correspond plot filter with the index to the filter array
				let value = 0.0;

				if(latest_data) {
					value = data["data"][j]["stations"][station_list[i]];
				}

				plots[i].data[station_list[i]].push(value);
			}
		}

		for(let i = 0; i < plots.length; i++) {
			plots[i].draw();
		}
	}, 1000 * 60);

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
