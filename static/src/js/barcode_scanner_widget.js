function code_type_changed(e){
    if ($('input[name="scan_code_type"]:checked').val() == 1)
        $('.o_barcode_type_selector').show()
    else if ($('input[name="scan_code_type"]:checked').val() == 0)
        $('.o_barcode_type_selector').hide()
}

odoo.define('webcam_qrcode_scan.custom_webcam_scanner', function (require) {
    "use strict";

    const FieldChar = require('web.basic_fields').FieldChar;
    const core = require('web.core');
    const fieldRegistry = require('web.field_registry');
    const QWeb = core.qweb;
    const Dialog = require('web.Dialog');
    const _t = core._t;

    let BarcodeScannerWidget = FieldChar.extend({
        description: _t("QR/Barcode Scanner"),
        events: _.extend({}, FieldChar.prototype.events, {
            'click .qr_scan_button': '_get_user_config',
        }),

        _scan_code: function(){
            if (this.device_uid === ''){
                this.do_warn(_t("Aborting"), "No Devices Available");
            }else{
                self = this
                this.$( "#webcam_viewport" ).show();
                this.$( "#webcam_viewport" ).height('250px');
                if (this.code_type == 1){
                    this._decode_barcode(self);
                }else if (this.code_type == 0){
                    this._decode_qrcode(self);
                }
            }
        },

        _decode_barcode: function (self){
            Quagga.init({
                inputStream : {
                  name : "Live",
                  type : "LiveStream",
                  target: document.querySelector('#webcam_viewport'),
                  constraints: {
                    width: 300,
                    height: 250,
                    facingMode: "environment",
                    deviceId: this.device_uid,
                  },
                },
                decoder : {
                  readers : [{
                    format: this.barcode_reader,
                    config: {}
                  }]
                },
            },
            function(err) {
                if (err) {
                    console.log(err);
                    return
                }
                Quagga.start();
            });

            Quagga.onProcessed(function(result) {
                let drawingCtx = Quagga.canvas.ctx.overlay,
                    drawingCanvas = Quagga.canvas.dom.overlay;
                if (result) {
                    if (result.boxes) {
                        drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                        result.boxes.filter(function (box) {
                            return box !== result.box;
                        }).forEach(function (box) {
                            Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                        });
                    }
                    if (result.box)
                        Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
                    if (result.codeResult && result.codeResult.code)
                        Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
                }
            });

            Quagga.onDetected(function(result){
                let qrCodeMessage = result.codeResult.code
                Quagga.stop();
                self.$( "#webcam_viewport" ).hide();
                self.$('.message_decode').val(qrCodeMessage)
                self._setValue(qrCodeMessage)
                self.do_notify(_t("QR Code detected"), qrCodeMessage);
            });
        },

        _decode_qrcode: function (self){
            if (self.device_uid != ''){
                const QrCode = new Html5Qrcode("webcam_viewport")
                $('#webcam_viewport').height('250px')
                QrCode.start(
                    self.device_uid, { fps: 10, qrbox: 170},
                    qrCodeMessage => {
                        QrCode.stop()
                        $('#webcam_viewport').height('0px')
                        self.$('.message_decode').val(qrCodeMessage)
                        self._setValue(qrCodeMessage)
                        self.do_notify(_t("QR Code detected"), qrCodeMessage)
                    },
                    errorMessage => {console.log("QR code not detected")}
                ).catch(err => {self.do_warn(_t("Unable to start scanning"), err)})
            }
        },

        _get_user_config: function (){
            self = this;
            Html5Qrcode.getCameras().then(function(devices){
                let dialog = new Dialog(self, {
                    size: 'medium',
                    dialogClass: 'o_act_window',
                    title: _t("Available Devices"),
                    $content: $(QWeb.render("device_selector", {devices: devices})),
                    buttons: [{
                        text: _t("Start Scanning"), classes: 'btn-primary', close: true,
                        click: function () {
                            let device = $('.o_camera_selector').children("option:selected").val();
                            let type = $('input[name="scan_code_type"]:checked').val();
                            let reader = $('.o_barcode_type_selector option:selected').val();
                            self.device_uid = device;
                            self.code_type = type;
                            self.barcode_reader = reader;
                        }
                    }]
                }).open();

                dialog.on('closed', self, function () {
                    self._scan_code();
                })
            }).catch(err => {
                this.do_warn(_t("Camera Not Found"), err);
            });
        },

        init: function() {
            this._super.apply(this, arguments);
            this.device_uid = "";
            this.code_type = 0;
            this.barcode_reader = "";
            this.data = "";
        },

        _renderEdit: function () {
            let self = this
            return Promise.resolve(self._super()).then(function () {
                self.$el.addClass('message_decode');
                self.setElement(self.$el.wrap('<div class="o_qrcode_scanner_widget"></div>').parent());
                self.$el.append(QWeb.render('widget_qrcode_scanner'));
                self.setElement(self.$el.wrap('<div></div>').parent());
                $('<div id="webcam_viewport" class="o_live_scan_result"></div>').appendTo(self.$el)
            });
        },
    })
    fieldRegistry.add('barcode_scanner', BarcodeScannerWidget);
    return BarcodeScannerWidget
});