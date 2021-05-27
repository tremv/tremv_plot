(function() {
	const canvas = document.getElementById("canvas");
	const context = canvas.getContext("2d");
	const values = [];

	for(let i = 0; i < 1440; i++) {
		let height = Math.random() * window.innerHeight/2.0;
		values.push(height);
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

	function render() {
		let canvas_width = 1440;
		let canvas_height = window.innerHeight-20;//20 is some arbritrary value to account for the scrollbar at the bottom??

		context.canvas.height = canvas_height;
		context.canvas.width = canvas_width;

		context.clearRect(0, 0, canvas_width, canvas_height);
		//context.transform(1, 0, 0, -1, 0, canvas_height);

		let image = context.createImageData(canvas_width, canvas_height);

		//þarf að gera eitthvað betra en að "handfilla" inn í minnið
		for(let y = 0; y < canvas_height; y++) {
			for(let x = 0; x < canvas_width; x++) {
				let index = canvas_width*y*4 + x*4;
				if(x % 30 == 0) {
					image.data[index] = 187;
					image.data[index + 1] = 187;
					image.data[index + 2] = 187;
					image.data[index + 3] = 255;
				}else if(x % 10 == 0) {
					image.data[index] = 204;
					image.data[index + 1] = 238;
					image.data[index + 2] = 255;
					image.data[index + 3] = 255;
				}
			}
		}

		context.putImageData(image, 0, 0);
		let str = "hello";
		let str_font = "serif";
		let str_size = 40;
		let text_width = measureTextWidth(context, str, str_font, str_size);

		drawText(context, str,  canvas_width/2.0 - text_width/2.0, 100, str_font, str_size, "#000000");
		//get bætt við 0.5 á x til teikna 1 pixel
		drawLine(context, canvas_width/2.0 + 0.5, 0, canvas_width/2.0 + 0.5, canvas_height, "#FF00FF", 1);
	}

	render();

	setInterval(function() {
		render();
	}, 1000 * 60);
})();
