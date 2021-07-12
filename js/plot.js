(function() {
	const main_canvas = document.getElementById("canvas");
	const main_context = main_canvas.getContext("2d");
	const plot_canvas = document.createElement("canvas");
	const plot_context = plot_canvas.getContext("2d");

	const stations = {};
	const buffer_size = 1440;
	const station_list = ["gri", "hrn", "sig", "hla", "gra", "lei", "bre", "hed", "gil", "dim", "ski", "gha", "kvo", "ren", "mel", "grs", "sva"];

	const str_font = "Arial";
	const str_size = 14;

	let grid_height = canvas_height - 30;
	let plot_count = Object.keys(stations).length;
	let plot_height = grid_height/plot_count;

	for(let i = 0; i < station_list.length; i++) {
		let values = [];//TODO: this should be a ring buffer
		for(let j = 0; j < buffer_size; j++) {
			values.push(Math.random());
		}
		stations[station_list[i]] = values;
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

	function producePlot(context, width, height) {
		drawRect(context, 0, 0, width, height, "#FFFFFF");

		//grid
		let grid_height = height - 30;
		let plot_count = Object.keys(stations).length;
		let plot_height = grid_height/plot_count;

		for(let x = 0; x < width; x++) {
			if(x % 60 == 0) {
				//the ~ operator is a bitwise NOT(meaning all bits will be flipped).
				//A double NOT is a weird way to truncate the float in javascript
				//which is essentially the same as int() in python
				let hour = (~~(x / 60)) % 24;
				let str = "";

				if(hour < 10) str += "0";
				str += hour;

				let text_width = measureTextWidth(context, str, str_font, str_size);
				let text_x = x - text_width/2.0;

				drawText(context, str, text_x, height-str_size/1.5, str_font, str_size, "#000000");
			}

			//Because of the way canvas rendering works, the 0.5 is here to get a pixel perfect line 
			let line_x = x + 0.5;
			let grid_y1 = grid_height + 6;

			if(x % 30 == 0) {
				drawLine(context, line_x, 0, line_x, grid_y1, "#AAAAAA", 1);
			}else if(x % 10 == 0) {
				drawLine(context, line_x, 0, line_x, grid_y1, "#CCEEFF", 1);
			}

			for(let i = 0; i < plot_count; i++) {
				let plot_y0 = plot_height * i + plot_height;
				let color = (i % 2 == 0) ? "#CC4444" : "#44CC44";
				drawLine(context, line_x, plot_y0, line_x, plot_y0 - stations[station_list[i]][x]*(plot_height-10), color, 1);
			}
		}
	}

	//update some dimension globals; resize and start up
	function update() {
		let canvas_width = buffer_size;
		let canvas_height = window.innerHeight-20;//20 is some arbritrary value to account for the scrollbar at the bottom??

		main_context.canvas.height = canvas_height;
		main_context.canvas.width = canvas_width;
		plot_context.canvas.height = canvas_height;
		plot_context.canvas.width = canvas_width;
	}

	//TODO: 
	//	*	Re-render if the page dimnesions change and stuff
	//	*	Display time a line where the cursor is and show the time next to it
	//	*	Express the width of the canvas as a ratio of the page size, so something like 70% or something
	//	*	When we scroll, the text should follow. The plot could be written to a seperate buffer,
	//		and then we could just write from it to the backbuffer and then draw the text...
	//	*	Cut image from the left to the position of the scroll bar, so we don't get a scuffed image
	//		when we open it in a new tab
	function render(width, height) {
		//þetta er í rauninni global breytur sem þarf að uppfæra
		/*
		*/

		//https://www.html5rocks.com/en/tutorials/canvas/hidpi/
		//https://stackoverflow.com/questions/40066166/canvas-text-rendering-blurry
		//https://stackoverflow.com/questions/8028864/using-nearest-neighbor-with-css-zoom-on-canvas-and-img
		/*
		context.canvas.height = context.canvas.clientHeight*2;
		context.canvas.width = context.canvas.clientWidth*2;
		context.scale(2,2);
		*/

		producePlot(plot_context, canvas_width, canvas_height);
		main_context.drawImage(plot_canvas, 0, 0);

		//NOTE: þetta er að tveimur stöðum :(

		for(let i = 0; i < plot_count; i++) {
			drawText(main_context, station_list[i], 5, i * plot_height + plot_height/3, str_font, str_size, "#000000");
		}
	}

	render();

	//render plot to buffer and re render the text on top
	setInterval(function() {
		render();
	}, 1000 * 60);
	
	window.onresize = function(e) {
		update();
	}

	//re render plot and the text on top
	document.getElementById("plot_container").onscroll = function(e) {
		/*
		main_context.drawImage(plot_canvas, 0, 0);
		let plot_count = Object.keys(stations).length;
		for(let i = 0; i < plot_count; i++) {
			let x = e.target.scrollLeft + 5;		
			drawText(main_context, station_list[i], x, i * 50 + 50/3, "Arial", 14, "#000000");
		}
		*/
	};
})();
