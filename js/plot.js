//Author Þórður Ágúst Karlsson
//
//TODO: correct time labels
//TODO: create a ring buffer so appending of latest data automatically makes everything wrap
(async function() {
	const main_canvas = document.getElementById("canvas");
	const main_context = main_canvas.getContext("2d");
	const plot_canvas = document.createElement("canvas");
	const plot_context = plot_canvas.getContext("2d");

	const stations = {};
	const buffer_size = 1440;
	const station_list = ["gri", "hrn", "sig", "hla", "gra", "lei", "bre", "hed", "gil", "dim", "ski", "gha", "kvo", "ren", "mel", "grs", "sva"];
	//const station_list = ["gri", "hrn", "sig", "hla", "gra", "faf"]; //TODO: virkar ekki út af faf
	//const station_list = ["gri", "hrn", "sig", "hla", "gra"];
	const filters = [[0.5, 1.0]];

	const str_font = "Arial";
	const str_size = 14;
	const plot_container = document.getElementById("plot_container");
	const base_url = window.location.origin;

	const init_range_end = new Date(Date.now() - 1000*60);//get the current timestamp minus 1 min
	const day_in_msec = 60*60*24 * 1000;
	const init_range_start = new Date(init_range_end - day_in_msec);

	init_query = {};
	init_query["filters"] = filters;
	init_query["station_names"] = [];
	init_query["do_log_transform"] = false;

	for(let i = 0; i < station_list.length; i++) {
		init_query["station_names"].push(station_list[i]);
	}

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

	for(let i = 0; i < station_list.length; i++) {
		stations[station_list[i]] = init_json["data"][0]["stations"][station_list[i]];
	}
	console.log("after post");

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

	//TODO: 
	//	*	Re-render if the page dimnesions change and stuff
	//	*	Display time a line where the cursor is and show the time next to it
	//	*	Express the width of the canvas as a ratio of the page size, so something like 70% or something
	//	*	When we scroll, the text should follow. The plot could be written to a seperate buffer,
	//		and then we could just write from it to the backbuffer and then draw the text...
	//	*	Cut image from the left to the position of the scroll bar, so we don't get a scuffed image
	//		when we open it in a new tab
	function drawPlot(new_data=true) {
		//https://www.html5rocks.com/en/tutorials/canvas/hidpi/
		//https://stackoverflow.com/questions/40066166/canvas-text-rendering-blurry
		//https://stackoverflow.com/questions/8028864/using-nearest-neighbor-with-css-zoom-on-canvas-and-img
		/*
		context.canvas.height = context.canvas.clientHeight*2;
		context.canvas.width = context.canvas.clientWidth*2;
		context.scale(2,2);
		*/
		let width = buffer_size;
		let height = window.innerHeight-20;//20 is some arbritrary value to account for the scrollbar at the bottom??

		main_context.canvas.height = height;
		main_context.canvas.width = width;
		plot_context.canvas.height = height;
		plot_context.canvas.width = width;

		//grid
		let grid_height = height - 30;
		//TODO: create a union of this list and station_list(so that we draw nothing where we have no data)
		let plot_count = Object.keys(stations).length;
		let plot_height = grid_height/plot_count;
		let station_maxes = [];
		let station_mins = [];

		for(let i = 0; i < plot_count; i++) {
			let plot_max = 0;
			let plot_min = 1 << 30;

			for(let j = 0; j < buffer_size; j++) {
				let value = Math.abs(stations[station_list[i]][j]);
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

		//This doesn't work for some reason. The idea is to cache the plot and just redraw the image
		//if there is no new data.
		if(new_data) {
			drawRect(plot_context, 0, 0, width, height, "#FFFFFF");

			for(let x = 0; x < width; x++) {
				if(x % 60 == 0) {
					//the ~ operator is a bitwise NOT(meaning all bits will be flipped).
					//A double NOT is a weird way to truncate the float in javascript
					//which is essentially the same as int() in python
					let hour = (~~(x / 60)) % 24;
					let str = "";

					if(hour < 10) str += "0";
					str += hour;

					let text_width = measureTextWidth(plot_context, str, str_font, str_size);
					let text_x = x - text_width/2.0;

					drawText(plot_context, str, text_x, height-str_size/1.5, str_font, str_size, "#000000");
				}

				//Because of the way canvas rendering works, the 0.5 is here to get a pixel perfect line 
				let line_x = x + 0.5;
				let grid_y1 = grid_height + 6;

				if(x % 30 == 0) {
					drawLine(plot_context, line_x, 0, line_x, grid_y1, "#AAAAAA", 1);
				}else if(x % 10 == 0) {
					drawLine(plot_context, line_x, 0, line_x, grid_y1, "#CCEEFF", 1);
				}

				for(let i = 0; i < plot_count; i++) {
					let value = Math.abs(stations[station_list[i]][x])
					if(value > 0) {
						value -= station_mins[i];
						let scale_factor = station_maxes[i] - station_mins[i];

						let plot_y0 = plot_height * i + plot_height;
						let plot_y1 = plot_y0 - (value/scale_factor * plot_height);

						let color = (i % 2 == 0) ? "#CC4444" : "#44CC44";
						drawLine(plot_context, line_x, plot_y0, line_x, plot_y1, color, 1);
					}
				}
			}
		}

		let x_offset = plot_container.scrollLeft;

		main_context.drawImage(plot_canvas, 0, 0);

		for(let i = 0; i < plot_count; i++) {
			let x = x_offset + 5;
			let y = i * plot_height + plot_height/3;
			let width = measureTextWidth(plot_context, station_list[i], str_font, str_size);
			let height = str_size;
			//drawRect(main_context, x, y-height, width, height, "#FFFFFF");
			drawText(main_context, station_list[i], x, y, str_font, str_size, "#000000");
		}
	}

	drawPlot();

	//render plot to buffer and re render the text on top
	setInterval(async function() {
		query = {};
		query["station_names"] = station_list;
		query["filters"] = filters;

		await fetch(base_url + "/api/latest/", 
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(query)
			}
		).then(function(response) {
			response.json().then(function(data) {
				for(let i = 0; i < station_list.length; i++) {
					//TODO: ring buffer!
					stations[station_list[i]].push(data["data"][0]["stations"][station_list[i]]);
				}
			});
		}).catch(function(error) {
			console.log("Request failed", error);
		});

		//TODO: wait for request...
		drawPlot();
	}, 1000 * 60);

	//re render plot and the text on top
	plot_container.onscroll = function(e) {
		drawPlot(false);
	};
})();
