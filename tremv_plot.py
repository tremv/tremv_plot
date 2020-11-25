from PyQt5 import QtGui
from PyQt5 import QtCore
from PyQt5 import QtWidgets
import os
import sys
import datetime
import time
import random
import math
import json
import requests

def lerp(a, b, t):
    return a + (b - a)*t

def print_transform(t):
    print(str(t.m11()) + ", " + str(t.m21()) + ", " + str(t.m31()))
    print(str(t.m21()) + ", " + str(t.m22()) + ", " + str(t.m32()))
    print(str(t.m31()) + ", " + str(t.m32()) + ", " + str(t.m33()))
    print()

class ringBuffer():
    def __init__(self, size):
        self.data = [None for i in range(0, size)]
        self.size = size
        self.start = 0
        self.count = 0
        self.iterator_index = 0

    def append(self, element):
        index = self.start + self.count
        if(index >= self.size):
            index -= self.size

        self.data[index] = element

        if(self.count < self.size):
            self.count += 1
        else:
            self.start += 1
            if(self.start >= self.size):
                self.start = 0

    #Increasing the capacity is trivial, just set the size to the new size.
    #Shrinking the buffer seems like it would involve a little more work?
    def resize(self, new_size):
        pass

    def __getitem__(self, index):
        #NOTE: maybe also do type checking on the index variable because python sucks
        if(self.count == 0):
            return None

        if(index == -1):
            index = self.count-1

        if(index >= self.count or index < -1):
            raise IndexError

        true_index = self.start + index
        if(true_index >= self.size):
            true_index -= self.size

        return self.data[true_index]
    
    def __setitem__(self, index, value):
        if(index == -1):
            index = self.count-1

        if(index >= self.count or index < -1):
            raise IndexError

        true_index = self.start + index
        if(true_index >= self.size):
            true_index -= self.size

        self.data[true_index] = value

    def __len__(self):
        return self.count

    def __iter__(self):
        self.iterator_index = 0
        return self

    def __next__(self):
        if(self.iterator_index == self.count):
            raise StopIteration

        index = self.start + self.iterator_index
        if(index >= self.size):
            index -= self.size

        result = self.data[index]
        self.iterator_index += 1

        return result

class rsam_station():
    def __init__(self, size):
        self.data = ringBuffer(size)
        self.min_value = sys.maxsize
        self.max_value = 0

class guiRenderPanel(QtWidgets.QWidget):
    def __init__(self, station_names, buffer_size):
        QtWidgets.QWidget.__init__(self)
        self.setSizePolicy(QtWidgets.QSizePolicy.MinimumExpanding, QtWidgets.QSizePolicy.MinimumExpanding)
        self.origin_x = 0.0
        self.origin_y = 0.0
        self.hour_font = QtGui.QFont("Arial", 10)#NOTE:the font is not behaving properly...
        self.hour_fm = QtGui.QFontMetrics(self.hour_font)
        self.station_names = station_names
        self.buffer_size = buffer_size
        self.stations = {}
        self.view_offset = 1#This should probably always be 1 when we are in the normal mode of fetching stuff
        self.widget_width = 1
        self.widget_height = 1
        self.minute = 0
        self.minute_starttime = 0

    def sizeHint(self):
        return QtCore.QSize(300, 300)

    #NOTE: this is like a "render" function, so it makes sense to pull out some stuff that is doing logical updating
    def paintEvent(self, e):
        p = QtGui.QPainter()
        p.begin(self)
        p.setFont(self.hour_font)

        self.widget_width = p.device().width()
        self.widget_height = p.device().height()

        p.fillRect(0, 0, self.widget_width, self.widget_height, QtGui.QColor("#FFFFFF"))

        p.translate(self.origin_x, self.origin_y)

        #NOTE: if we want to get fancy, then maybe having a seperate space for the grid and plot would make sense...
        plot_transform = p.transform()
        tick_margin = self.hour_fm.height() + (self.widget_height/32)
        plot_transform.translate(0, self.widget_height - tick_margin)#offset along y so the plotting happens above the tick marks

        #do translation based on the view offset value...
        plot_offset_x = self.buffer_size-self.widget_width
        view_translation_x = lerp(0, plot_offset_x, self.view_offset)

        if(plot_offset_x > 0):
            plot_transform.translate(-view_translation_x, 0)
            plot_transform.scale(1, 1)
        else:
            #NOTE: this should not apply to the grid and stuff, but it currently does..
            plot_transform.scale(self.widget_width/self.buffer_size, 1)

        #plot space
        p.setTransform(plot_transform)

        old_pen = p.pen()
        text_pen = QtGui.QPen(QtGui.QColor("#000000"))
        thirty_min_pen = QtGui.QPen(QtGui.QColor("#BBBBBB"))
        ten_min_pen = QtGui.QPen(QtGui.QColor("#CCEEFF"))

        grid_space = 10

        #TODO: this minute offset thing is hacky...
        minute_offset = self.minute - self.buffer_size
        if(minute_offset < 0):
            minute_offset = 0

        grid_offset = minute_offset + self.minute_starttime
        grid_start = ((int(view_translation_x + grid_offset)//grid_space)+1) * grid_space
        if(grid_start < 0):
            grid_start = 0

        for i in range(grid_start - grid_space, grid_start + self.widget_width + grid_space):
            if(i % grid_space == 0):
                p.setPen(ten_min_pen)

                #Every third grid line
                if(i % (grid_space * 3) == 0):
                    p.setPen(thirty_min_pen)

                x = i - grid_offset

                p.drawLine(x, int(tick_margin/4), x, -self.widget_height)

                p.setPen(text_pen)
                #Every sixth grid line
                if(i % (grid_space * 6) == 0):
                    hour = (i // (grid_space * 6)) % 24
                    hour_str = ""
                    if(hour < 10):
                        hour_str += "0"

                    hour_str += str(hour)

                    text_width = self.hour_fm.boundingRect(hour_str).width()
                    text_y = int((tick_margin/2) - self.hour_fm.height()/4)
                    p.drawText(int(x - text_width/2), text_y, text_width+1, self.hour_fm.height(), QtCore.Qt.AlignLeft, hour_str)


        plot_even_color = QtGui.QPen(QtGui.QColor("#d62d20"))
        plot_odd_color = QtGui.QPen(QtGui.QColor("#00A900"))
        
        plot_height = (self.widget_height-tick_margin) / len(self.station_names)

        y_i = len(self.station_names)-1
        for name in self.station_names:
            station = self.stations[name]
            y0 = -plot_height * y_i

            if(y_i % 2 == 0):
                p.setPen(plot_even_color)
            else:
                p.setPen(plot_odd_color)

            data_start = int(view_translation_x)
            data_end = data_start + self.widget_width

            if(data_start < 0):
                data_start = 0

            if(data_end > len(station.data)):
                data_end = len(station.data)

            if(data_start < data_end):
                for x in range(data_start, data_end):
                    value = station.data[x]-station.min_value
                    if(value < 0.0):
                        value = 0.0

                    scale_factor = station.max_value - station.min_value
                    if(scale_factor == 0):
                        scale_factor = 1

                    y1 = int(y0 - (plot_height * value)/scale_factor)#we do minus because the y-axis start from the top
                    p.drawLine(x, int(y0), x, y1)

            #Maybe use a different font? Atleast a different size
            text_width = self.hour_fm.boundingRect(name).width()
            text_y0 = int(y0-plot_height + plot_height/8)
            text_x0 = grid_space/2

            if(plot_offset_x > 0):
                text_x0 += view_translation_x


            p.setPen(old_pen)
            p.fillRect(int(text_x0), text_y0, text_width, self.hour_fm.height(), QtGui.QColor("#FFFFFF"))
            p.drawText(int(text_x0), text_y0, text_width, self.hour_fm.height(), QtCore.Qt.AlignLeft, name)

            y_i -= 1

        #screen space
        p.resetTransform()
        p.drawRect(0, 0, self.widget_width-1, self.widget_height-1)

        p.end()

class guiPlotSlider(QtWidgets.QSlider):
    def __init__(self, panel):
        QtWidgets.QSlider.__init__(self, QtCore.Qt.Horizontal)
        self.panel = panel
        self.setMaximum(self.panel.buffer_size)
        self.setValue(self.maximum() * self.panel.view_offset)
        self.valueChanged.connect(self.value_changed)

    def value_changed(self):
        self.panel.view_offset = self.value()/self.maximum()
        self.panel.update()

def add_to_station(station, value):
    if(value > 0.0):
        value = abs((1000*math.log(abs(value))))

    station.data.append(value)
    if(value < station.min_value):
        if(value > 0.0):
            station.min_value = value

    if(value > station.max_value):
        station.max_value = value


def read_tremvplot_config(filename):
    result = {}
    server_address = ""
    station_names = []

    if(os.path.exists(filename)):
        config_file = open(filename, "r")
        lines = config_file.readlines()

        server_address = lines[0].rstrip()
        station_names = []

        for i in range(1, len(lines)):
            line = lines[i]
            formatted_line = line.rstrip()
            station_names.append(formatted_line)

        config_file.close()

    result["server_address"] = server_address
    result["station_names"] = station_names

    return(result)


def write_tremvplot_config(filename, config):
    config_file = open(filename, "w")

    config_file.write(config["server_address"]+"\n")

    for name in config["station_names"]:
        config_file.write(name + "\n")

    config_file.close()


class confirmedListWidget(QtWidgets.QListWidget):
    def __init__(self):
        QtWidgets.QListWidget.__init__(self)

    def Clicked(self, item):
        self.takeItem(self.currentRow())


class serverListWidget(QtWidgets.QListWidget):
    def __init__(self, confirmed_widget):
        QtWidgets.QListWidget.__init__(self)
        self.confirmed_widget = confirmed_widget

    def Clicked(self, item):
        found_items = self.confirmed_widget.findItems(item.text(), QtCore.Qt.MatchExactly)

        if(len(found_items) == 0):
            self.confirmed_widget.addItem(item.text())
            self.confirmed_widget.setCurrentRow(self.confirmed_widget.count()-1)
        else:
            message_box = QtWidgets.QMessageBox()
            message_box.setText("This station has already been added!")
            message_box.exec()


class clearButton(QtWidgets.QPushButton):
    def __init__(self, confirmed_widget):
        QtWidgets.QPushButton.__init__(self)
        self.setText("Clear")
        self.confirmed_widget = confirmed_widget

    def Clicked(self):
        self.confirmed_widget.clear()


class acceptButton(QtWidgets.QPushButton):
    def __init__(self, dialog, station_names, filters, confirmed_widget, filter_checkboxes):
        QtWidgets.QPushButton.__init__(self)
        self.setText("Accept")
        self.dialog = dialog
        self.station_names = station_names
        self.filters = filters
        self.confirmed_widget = confirmed_widget
        self.filter_checkboxes = filter_checkboxes

    def Clicked(self):
        for i in range(0, self.confirmed_widget.count()):
            item = self.confirmed_widget.item(i)
            self.station_names.append(item.text())

        for pair in self.filter_checkboxes:
            if(pair[0].checkState() == QtCore.Qt.Checked):
                self.filters.append(pair[1])

        self.dialog.accept()


class configDialog(QtWidgets.QDialog):
    def __init__(self, station_names, filters, config_station_names, server_station_names, server_filters):
        QtWidgets.QDialog.__init__(self)
        self.layout = QtWidgets.QVBoxLayout()
        self.layout.addWidget(QtWidgets.QLabel("Select the stations from the right list that you wish to display(click on stations on the left to remove them):"))
        self.setModal(True)

        self.live_mode = True

        selection_layout = QtWidgets.QHBoxLayout()

        station_confirmed_list = confirmedListWidget()
        station_server_list = serverListWidget(station_confirmed_list)

        station_confirmed_list.itemClicked.connect(station_confirmed_list.Clicked)
        station_server_list.itemClicked.connect(station_server_list.Clicked)

        for name in server_station_names:
            station_server_list.addItem(name)

        if(len(config_station_names) == 0):
            for name in server_station_names:
                station_confirmed_list.addItem(name)
        else:
            for name in config_station_names:
                station_confirmed_list.addItem(name)

        selection_layout.addWidget(station_confirmed_list)
        selection_layout.addWidget(station_server_list)

        self.layout.addLayout(selection_layout)

        clear_layout = QtWidgets.QHBoxLayout()

        clear_button = clearButton(station_confirmed_list)
        clear_button.clicked.connect(clear_button.Clicked)

        clear_layout.addWidget(clear_button)
        clear_layout.addStretch()
        self.layout.addLayout(clear_layout)

        self.layout.addWidget(QtWidgets.QLabel("Available filters:"))

        filter_layout = QtWidgets.QHBoxLayout()
        filter_checkboxes = []

        for f in server_filters:
            checkbox = QtWidgets.QCheckBox(str(f[0]) + " - " + str(f[1]))
            filter_layout.addWidget(checkbox)
            filter_checkboxes.append([checkbox, f])

        self.layout.addLayout(filter_layout)

        self.radio_latest = QtWidgets.QRadioButton("Latest")
        self.radio_past = QtWidgets.QRadioButton("Past Data")

        self.datepicker = QtWidgets.QCalendarWidget()
        self.datepicker.setMaximumDate(QtCore.QDate.currentDate().addDays(-1))

        self.radio_latest.toggled.connect(lambda: self.datepicker.setDisabled(True))
        self.radio_past.toggled.connect(lambda: self.datepicker.setDisabled(False))

        self.radio_latest.setChecked(True)

        self.layout.addWidget(self.radio_latest)
        self.layout.addWidget(self.radio_past)
        self.layout.addWidget(self.datepicker)

        accept_layout = QtWidgets.QHBoxLayout()

        accept_button = acceptButton(self, station_names, filters, station_confirmed_list, filter_checkboxes)
        accept_button.clicked.connect(accept_button.Clicked)

        accept_layout.addWidget(accept_button)
        accept_layout.addStretch()
        self.layout.addLayout(accept_layout)

        self.setLayout(self.layout)
        self.exec_()

    def closeEvent(self, event):
        sys.exit()


class serverDialog(QtWidgets.QWidget):
    def __init__(self, config):
        QtWidgets.QWidget.__init__(self)
        self.config = config

        while(True):
            text, ok = QtWidgets.QInputDialog.getText(self, "Server Config", "Tremv Server Address:", text=config["server_address"])
            if(ok == False):
                sys.exit()
            else:
                try:
                    #NOTE: we need to make a connection to verify the input
                    address = text.rstrip()
                    r = requests.get("http://" + address + "/")
                    config["server_address"] = address
                    break

                except Exception as e:
                    print(e)
                    message_box = QtWidgets.QMessageBox()
                    message_box.setText("No tremv server found at address " + "\"" + text + "\"")
                    message_box.exec()


class globalState():
    def __init__(self):
        self.fps = 1
        self.buffer_size = 60*24
        self.station_names = []
        self.filters = []
        self.panels = []
        self.stations_per_filter = []
        self.gui_font = QtGui.QFont("Arial", 10)
        self.date_label = None
        self.url = ""

program_state = globalState()

def update():
    today = datetime.datetime.now()
    program_state.date_label.setText(str(today.year) + "/" + str(today.month) + "/" + str(today.day))

    query = {}
    query["filters"] = program_state.filters
    query["station_names"] = program_state.station_names

    request_latest = requests.post(program_state.url + "latest", json=query)
    latest_data = request_latest.json()

    for i in range(0, len(program_state.filters)):
        latest_stations = latest_data[i]["stations"]

        for name in program_state.station_names:
            add_to_station(program_state.panels[i].stations[name], latest_stations[name])

        program_state.panels[i].minute += 1
        program_state.panels[i].update()

    print("display updated")
        

def main():
    app = QtWidgets.QApplication([])
    w = QtWidgets.QWidget()
    grid_layout = QtWidgets.QGridLayout()
    w.setLayout(grid_layout)

    config_filename = ".tremvconf"
    config = read_tremvplot_config(config_filename)

    server_dialog = serverDialog(config)
    program_state.url = "http://" + config["server_address"] + "/"

    request_station_names = requests.get(program_state.url + "station_names")
    server_station_names = request_station_names.json()

    request_filters = requests.get(program_state.url + "filters")
    server_filters = request_filters.json()

    station_names = program_state.station_names
    filters = program_state.filters

    config_dialog = configDialog(station_names, filters, config["station_names"], server_station_names, server_filters)
    live_mode = config_dialog.radio_latest.isChecked()
    
    if(len(filters) == 0):
        for f in server_filters:
            filters.append(f)

    if(len(station_names) == 0):
        for s in server_station_names:
            station_names.append(s)

    config["station_names"].clear()
    for name in station_names:
        config["station_names"].append(name)

    write_tremvplot_config(config_filename, config)

    #Needed for label and minute_starttime in live_mode
    today = datetime.datetime.now()
    yesterday = today - datetime.timedelta(days=1)

    date_label = QtWidgets.QLabel()

    if(live_mode == False):
        query = {}
        query["filters"] = filters
        query["station_names"] = station_names

        date = config_dialog.datepicker.selectedDate()
        query["date"] = {"year": date.year(), "month": date.month(), "day": date.day()}

        request_date = requests.post(program_state.url + "date", json=query)
        data = request_date.json()

        for i in range(0, len(filters)):
            stations = {}

            for name in station_names:
                stations[name] = rsam_station(program_state.buffer_size)

                for j in range(0, 24*60):
                    value = 0.0

                    if(j < len(data[i]["stations"][name])):
                        value = data[i]["stations"][name][j]

                    add_to_station(stations[name], value)

            program_state.stations_per_filter.append(stations)

        date_label.setText(str(date.day()) + "/" + str(date.month()) + "/" + str(date.year()))

    else:
        query_yesterday = {}
        query_yesterday["filters"] = filters
        query_yesterday["station_names"] = station_names
        query_yesterday["date"] = {"year": yesterday.year, "month": yesterday.month, "day": yesterday.day}

        request_yesterday = requests.post(program_state.url + "date", json=query_yesterday)

        query_today = {}
        query_today["filters"] = filters
        query_today["station_names"] = station_names
        query_today["date"] = {"year": today.year, "month": today.month, "day": today.day}

        request_today = requests.post(program_state.url + "date", json=query_today)

        data_yesterday = request_yesterday.json()
        data_today = request_today.json()

        minute_of_day = today.minute + today.hour*60

        for i in range(0, len(filters)):
            stations = {}

            for name in station_names:
                stations[name] = rsam_station(program_state.buffer_size)

                for j in range(minute_of_day, 24*60):
                    value = 0.0

                    if(j < len(data_yesterday[i]["stations"][name])):
                        value = data_yesterday[i]["stations"][name][j]

                    add_to_station(stations[name], value)

                for j in range(0, minute_of_day):
                    value = 0.0

                    if(j < len(data_today[i]["stations"][name])):
                        value = data_today[i]["stations"][name][j]

                    add_to_station(stations[name], value)

            program_state.stations_per_filter.append(stations)

        date_label.setText(str(today.day) + "/" + str(today.month) + "/" + str(today.year))

    for i in range(0, len(filters)):
        f = filters[i]

        bandpass_layout = QtWidgets.QGridLayout()
        bandpass_label = QtWidgets.QLabel(str(f[0]) + " - " + str(f[1]) + "hz")
        bandpass_label.setFont(program_state.gui_font)
        bandpass_layout.addWidget(bandpass_label, 0, 0)

        if(i == len(filters)-1):
            date_label.setFont(program_state.gui_font)
            bandpass_layout.addWidget(date_label, 0, 1, QtCore.Qt.AlignRight)
            program_state.date_label = date_label

        grid_layout.addLayout(bandpass_layout, 0, i)

        panel = guiRenderPanel(station_names, program_state.buffer_size)
        panel.stations = program_state.stations_per_filter[i]

        if(live_mode == True):
            panel.minute_starttime = today.hour*60 + today.minute
            panel.minute += 1440

        program_state.panels.append(panel)
        grid_layout.addWidget(panel, 1, i)

        slider = guiPlotSlider(panel)
        grid_layout.addWidget(slider, 2, i)

    w.show()

    if(live_mode == True):
        timer = QtCore.QTimer()

        #do the updating!
        timer.timeout.connect(update)
        timer.start(1000*60)

    app.exec_()

main()
