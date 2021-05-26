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
		context.canvas.width = 1440;
		context.canvas.height = window.innerHeight;
		stride = 1440.0/window.innerWidth * 3;

		for(let i = 0; i < window.innerWidth; i++) {
			drawLine(context, i * stride, 0, i * stride, values[i], "#FF0000", 1);
		}
	}

	render();

	setInterval(function() {
		render();
	}, 1000 * 60);
})();
