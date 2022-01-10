//credit: bergur snorrason
export function floatCompare(x, y) {
	let eps = 1e-9;
	return (Math.abs(x - y) < eps);
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
export function drawLine(context, x0, y0, x1, y1, color, width) {
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