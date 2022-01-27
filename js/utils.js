//credit: bergur snorrason
export function floatCompare(x, y) {
	let eps = 1e-9;
	return (Math.abs(x - y) < eps);
}

export function daysInMs(days) {
	return 24*60*60*1000*days;
}

export function hoursInMs(hours) {
	return 60*60*1000*hours;
}

export function minutesInMs(minutes) {
	return 60*1000*minutes;
}

export function msToNextMin() {
	let min_in_ms = 1000 * 60;
	let now = Date.now();
	let current_min = ~~(now / min_in_ms);
	let next_min_in_ms = (current_min + 1) * min_in_ms;

	return next_min_in_ms - now;
}

export function datesEqual(d0, d1) {
	return (~~(d0.getTime() / daysInMs(1))) === (~~(d1.getTime() / daysInMs(1)));
}

export function copyToClipboard(str) {
	if("clipboard" in navigator) {
		navigator.clipboard.writeText(str);
	}else {
		let temp = document.createElement("input");
		document.body.appendChild(temp);
		temp.value = str;
		temp.select();
		document.execCommand("copy");
		document.body.removeChild(temp);
	}
}

export function getURLParams() {
	return new URLSearchParams(window.location.search);
}

//params er URLSearchParams hlutur sem fengin var með getURLParams
export function setURLParams(params) {
	history.pushState(null, "", window.location.pathname + "?" + params.toString());
}

//a container with a fixed size that overwrites elements when there is no space left
export class RingBuffer {
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
export function drawLine(context, x0, y0, x1, y1, width, color) {
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

export function drawRect(context, x, y, width, height, color) {
	let prev_color = context.fillStyle;
	context.fillStyle = color;
	context.fillRect(x, y, width, height);
	context.fillStyle = prev_color;
}

export function drawFilledPolygon(context, points, stroke_width, stroke_color, fill_color) {
	let prev_fill_color = context.fillStyle;
	let prev_stroke_color = context.strokeStyle;
	let prev_stroke_width = context.lineWidth;

	context.fillStyle = fill_color;
	context.strokeStyle = stroke_color;
	context.lineWidth = stroke_width;

	context.beginPath();
	context.moveTo(points[0][0], points[0][1]);

	for(let i = 1; i < points.length; i++) {
		context.lineTo(points[i][0], points[i][1]);
	}

	context.closePath();
	context.stroke();
	context.fill();

	context.fillStyle = prev_fill_color;
	context.strokeStyle = prev_stroke_color;
	context.lineWidth = prev_stroke_width;
}

export function drawText(context, text, x, y, font, size, color) {
	let prev_font = context.font;
	let prev_color = context.fillStyle;

	context.font = size.toString() + "px " + font;
	context.fillStyle = color;
	context.fillText(text, x, y);

	context.font = prev_font;
	context.fillStyle = prev_color;
}

export function measureTextWidth(context, text, font, size) {
	let result = 0.0;
	let prev_font = context.font;

	context.font = size.toString() + "px " + font;
	result = context.measureText(text).width;
	context.font = prev_font;

	return result;
}
