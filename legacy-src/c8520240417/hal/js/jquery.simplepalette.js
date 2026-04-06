/***
The MIT License (MIT)

Copyright (c) 2013 Petri Salmela

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@version 0.3
@author  Petri Salmela <pesasa@iki.fi>
@requires jQuery
@description  SimplePalette widget as jQuery plugin

***/

(function ($) {

    /**
     * Escape html for security
     */
    var escapeHTML = function(html) {
        return document.createElement('div')
            .appendChild(document.createTextNode(html))
            .parentNode
            .innerHTML
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    };

    /*** jQuery plugin ***/
    $.fn.simplepalette = function(options){
        if (methods[options]){
            return methods[options].apply( this, Array.prototype.slice.call( arguments, 1));
        } else if (typeof(options) === 'object' || !options) {
            return methods.init.apply(this, arguments);
        } else {
            $.error( 'Method ' +  method + ' does not exist on SimplePalette' );
            return this;
        }
    }

    var methods = {
        init: function(params){

            params = $.extend(true, {
            }, params);
            var picker = new SimplePalette(this, params);
            //picker.init();
        },
        getdata: function(params){
            var $place = $(this);
            $place.trigger('getdata');
            var data = $place.data('[[simplepalettedata]]');
            return data;
        }
    }

    /**
     * Color picker class
     * @class SimplePalette
     */
    class SimplePalette {

        constructor(place, options) {
            this.place = $(place);
            this.options = $.extend({}, this.defaults, options);
            if (this.place[0].tagName === 'INPUT') {
                this.init();
            };
        };

        init() {
            this.rgba = this.options.rgba;
            this.setStyles();
            this.place.addClass('simplepalettetool-input');
            this.wrapper = $(`
                <div class="simplepalettetool-wrapper">
                    <div class="simplepalettetool-outer">
                        <div class="simplepalettetool-inner">
                            <div class="simplepalettetool-preview"></div>
                        </div>
                    </div>
                    <div class="simplepalettetool-dialog"></div>
                </div>
            `);
            this.outer = this.wrapper.find('.simplepalettetool-outer');
            this.preview = this.wrapper.find('.simplepalettetool-preview');
            this.dialog = this.wrapper.children('.simplepalettetool-dialog');
            this.place.after(this.wrapper);
            if (!this.options.showInput) {
                this.place.addClass('simplepalettetool-hidden');
            }
            this.readColor();
            this.setPreview();
            this.initHandlers();
        };

        initHandlers() {
            let picker = this;
            this.place.off('change').on('change', function(event) {
                picker.readColor();
                picker.setPreview();
            });

            this.outer.off('click').on('click', function(event) {
                event.stopPropagation();
                if (picker.dialogIsOpen) {
                    picker.hideDialog();
                } else {
                    picker.showDialog();
                };
            });

            this.dialog.off('click', '.simplepalettetool-color').on('click', '.simplepalettetool-color', function(event) {
                let color = $(this).attr('data-color');
                picker.dialog.find('.simplepalettetool-currentcolor').removeClass('simplepalettetool-currentcolor');
                $(this).addClass('simplepalettetool-currentcolor');
                picker.setColor(color);
                picker.writeColor();
                picker.hideDialog();
            });

        };

        setColor(color) {
            if (color[0] === '#') {
                this.rgba = this.hex2rgba(color);
            } else if (color in this.colornames) {
                this.rgba = this.hex2rgba(this.colornames[color]);
            } else if (color.substr(0, 5) === 'rgba(') {
                this.rgba = this.str2rgba(color);
            } else {
                this.rgba = '';
            };
            this.setPreview();
        };

        readColor() {
            let color = this.place.val();
            this.setColor(color);
        };

        writeColor() {
            let output = (
                this.options.outputHex
                ? this.rgba2hex(this.rgba)
                : (this.rgba ? `rgba(${this.rgba.join(',')})` : '')
            );
            this.place.val(output);
            this.place.trigger('change');
        };

        setPreview() {
            let rgba = (Array.isArray(this.rgba) ? `rgba(${this.rgba.join(',')})` : '');
            if (rgba === '') {
                this.preview.addClass('color_is_none');
            } else {
                this.preview.removeClass('color_is_none');
            }
            this.preview.css({'background-color': (rgba ? rgba : 'white')});
        };

        showDialog() {
            let picker = this;
            this.dialog.addClass('simplepalettetool-show');
            this.dialogIsOpen = true;
            if (this.options.side === 'up') {
                this.dialog.addClass('simplepalettetool-side-up');
            } else {
                this.dialog.removeClass('simplepalettetool-side-up');
            };
            $('body').on('click.simplepaletteback', function(event) {
                picker.hideDialog();
            });
            this.dialog.html(this.getGrid());
        };

        hideDialog() {
            this.dialog.removeClass('simplepalettetool-show');
            this.dialogIsOpen = false;
            $('body').off('click.simplepaletteback');
            this.dialog.empty();
        };

        getDialog() {
            return this.getGrid();
        };

        getGrid() {
            let html = [];
            let currentColor = this.rgba2hex(this.rgba);
            let palettes = this.options.palettes;
            for (let i = 0, len = palettes.length; i < len; i++) {
                let palid = palettes[i];
                let palette = this.palettes[palid];
                if (palette) {
                    let colors = palette.colors;
                    let rowLength = palette.rowLength || colors.length;
                    html.push(`
                        <div class="simplepalettetool-palette-wrapper">
                            <div class="simplepalettetool-palette-title">
                            ${escapeHTML(palette.name)}
                            </div>
                            <div class="simplepalettetool-palette" data-palette="${escapeHTML(palid)}" style="grid-template-columns: repeat(${rowLength}, auto);">
                    `);
                    for (let j = 0, jlen = colors.length; j < jlen; j++) {
                        let color = colors[j];
                        let col = escapeHTML(color);
                        let classes = ['simplepalettetool-color'];
                        let isCurrent = (currentColor.substr(0,7) === col);
                        if (isCurrent) {
                            classes.push('simplepalettetool-currentcolor');
                        };
                        if (this.isDark(color)) {
                            classes.push('simplepalettetool-isdark');
                        };
                        if (!col) {
                            classes.push('color_is_none');
                        }
                        html.push(`
                            <div class="${classes.join(' ')}" data-color="${col ? col : 'none'}" title="${col ? col : 'none'}" style="background-color: ${col ? col : 'white'};"></div>
                        `);
                    };
                    html.push(`</div>`, `</div>`);
                };
            };
            return html.join('\n');
        };

        getHexGrid() {

        }

        /******
         * Hex to rgba
         ******/
        hex2rgba(hex){
            let result = '';
            if (hex !== 'none') {
                hex = hex + '#ffffffff'.slice(hex.length);
                let rgb = hex.substr(1,6);
                let alpha = hex.substr(7,2) || 'ff';
                let num = parseInt(rgb, 16);
                let r = (num >> 16) % 256;
                let g = (num >> 8) % 256;
                let b = num % 256;
                let a = parseInt(alpha, 16) / 255;
                result = [r, g, b, a];
            };
            return result;
        };

        /**
         * Rgba to Hex
         */
        rgba2hex(rgba) {
            let hex = '';
            if (Array.isArray(rgba)) {
                hex = rgba.slice(0,3).reduce(function(a, b) {
                    return a + ('00' + b.toString(16)).slice(-2);
                }, '#');
                hex += (rgba[3] * 255 | 0).toString(16);
            };
            return hex;
        };

        str2rgba(str) {
            return str.substring(5, str.length - 1).split(',').map( i => parseFloat(i));
        };

        isDark(color) {
            if (typeof(color) === 'string') {
                if (color[0] === '#') {
                    color = this.hex2rgba(color);
                } else if (color.substr(0,5) === 'rgba(') {
                    color = this.str2rgba(color);
                } else {
                    color = '';
                };
            };
            color = color || this.rgba;
            let sum = (color || []).reduce(function(a, b, index) {
                let c = (index === 3 ? 50 * b : b);
                return a + c;
            }, 0);
            return sum < 450;
        };

        setStyles() {
            if ($('head style#simplepalettetoolstyle').length === 0) {
                $('head').append(this.styles);
            };
        };

    };

    SimplePalette.prototype.defaults = {
        rgba: [0, 0, 0, 1],
        hasAlpha: false,
        width: '2em',
        showInput: true,
        outputHex: false,
        palettes: ['default', 'grayscale'],
        visiblePalette: true
    };

    /******
     * Named colors
     ******/
    SimplePalette.prototype.colornames = {
        'black':     '#000000',
        'white':     '#ffffff',
        'red'  :     '#ff0000',
        'green':     '#00ff00',
        'blue' :     '#0000ff',
        'yellow':    '#ffff00',
        'goldenyellow': '#ffdf00',
        'gold':      '#ffd700',
        'orange':    '#ff6600',
        'darkorange':'#ff8c00',
        'darkred':   '#aa0000',
        'darkgreen': '#00aa00',
        'darkolivegreen': '#556b2f',
        'olivedrab': '#6b8e23',
        'darkblue':  '#0000aa',
        'navy':      '#000080',
        'navyblue':  '#000080',
        'sky':       '#87ceeb',
        'skyblue':   '#87ceeb',
        'steel':     '#4682b4',
        'steelblue': '#4682b4',
        'royal':     '#4169e1',
        'royalblue': '#4169e1',
        'aqua':      '#00ffff',
        'cyan':      '#00ffff',
        'magenta':   '#ff00ff',
        'fuchsia':   '#ff00ff',
        'purple':    '#800080',
        'violet':    '#ee82ee',
        'indigo':    '#4b0082',
        'brown':     '#a52a2a',
        'chocolate': '#d2691e',
        'maroon':    '#800000',
        'saddlebrown':'#8b4513',
        'pink':      '#ffc0cb',
        'lime':      '#32cd32',
        'olive':     '#6b8e23',
        'debianred': '#d70a53',
        'gainsboro': '#dcdcdc',
        'lightgray': '#d3d3d3',
        'lightgrey': '#d3d3d3',
        'silver':    '#c0c0c0',
        'darkgray':  '#a9a9a9',
        'darkgrey':  '#a9a9a9',
        'gray':      '#808080',
        'grey':      '#808080',
        'dimgray':   '#696969',
        'dimgrey':   '#696969',
        'lightslategray': '#778899',
        'lightslategrey': '#778899',
        'slategray': '#708090',
        'slategrey': '#708090',
        'darkslategray': '#2f4f4f',
        'darkslategrey': '#2f4f4f',
        'none' :     'none'
    };

    SimplePalette.prototype.palettes = {
        'default': {
            name: 'Default',
            rowLength: 7,
            colors: [
                '#aa0000', '#aa4400', '#ffcc00', '#00aa00', '#0000ff', '#660080', '#aa0044',
                '#ff0000', '#ff6600', '#ffff00', '#00ff00', '#0066ff', '#aa0088', '#d70a53',
                '#ff8080', '#ff9955', '#ffdd55', '#bcd35f', '#80e5ff', '#ccaaff', '#ffaaee'
            ]
        },
        'grayscale': {
            name: 'Grayscale',
            colors: ['#000000', '#333333', '#4d4d4d', '#808080', '#999999', '#cccccc', '#ffffff']
        },
        '80s': {
            name: '80s',
            colors: ['#f04e36','#f36e27','#f3d430','#1eb19d','#ed1683']
        },
        'beach': {
            name: 'Beach',
            colors: ['#96ceb4','#ffeead','#ff6f69','#ffcc5c','#88d8b0']
        },
        'pastelteahouse': {
            name: 'Pastel Tea House',
            colors: ['#bfdfb8','#dcf1e6','#b8bfdf','#fcdcdf','#fff3b7']
        },
        'barbiessummerhouse': {
            name: 'Barbie\'s Summerhouse',
            colors: ['#ff98ff','#bf98f2','#819ae7','#3e96d6','#008fbf']
        },
        'bluespinkandgreen': {
            name: 'Blues Pink and Green',
            colors: ['#5f8fba','#ba5f8f','#8fba5f','#4c7294','#39556f']
        },
        'ubuntu': {
            name: 'Ubuntu',
            colors: ['#dd4814','#5e2750','#ffffff','#333333','#aea79f']
        },
        'princesspink': {
            name: 'Princess Pink',
            colors: ['#ffc2cd','#ff93ac','#ff6289','#fc3468','#ff084a']
        },
        'pinksigns': {
            name: 'Pink Signs',
            colors: ['#362433','#a51874','#e1388d','#f468ae','#ffcce6']
        },
        'pastelcolorsoftherainbow': {
            name: 'Pastel Colors of the Rainbow',
            colors: ['#ffb3ba','#ffdfba','#ffffba','#baffc9','#bae1ff']
        },
        'googlecolors': {
            name: 'Google Colors',
            colors: ['#008744','#0057e7','#d62d20','#ffa700','#ffffff']
        },
        'metrostyle': {
            name: 'Metro Style',
            colors: ['#00aedb','#a200ff','#f47835','#d41243','#8ec127']
        },
        'brighteyesandsummerskies': {
            name: 'Bright eyes and summer skies',
            colors: ['#f13057','#f68118','#f8ca00','#aef133','#19ee9f']
        },
        'sunsetinthewoods': {
            name: 'Sunset in the Woods',
            colors: ['#513026','#ffbed1','#ffee8c','#fba44a','#cc225e']
        },
        'cappuccino': {
            name: 'Cappuccino',
            colors: ['#4b3832','#854442','#fff4e6','#3c2f2f','#be9b7b']
        },
        'rainbowdash': {
            name: 'Rainbow Dash',
            colors: ['#ee4035','#f37736','#fdf498','#7bc043','#0392cf']
        },
        'armycamouflage': {
            name: 'Army Camouflage',
            colors: ['#604439','#9e9a75','#1c222e','#41533b','#554840']
        },
        'cannibalplants': {
            name: 'Cannibal Plants',
            colors: ['#87922c','#997a3a','#ad634a','#d43168','#e61978']
        },
        'purerosequartz': {
            name: 'Pure Rose Quartz',
            colors: ['#ea899a','#d37488','#a64966','#8f3453','#791f43']
        },
        'tango': {
            name: 'Tango',
            rowLength: 3,
            colors: [
                '#fce94f','#edd400','#c4a000',
                '#8ae234','#73d216','#4e9a06',
                '#fcaf3e','#f57900','#ce5c00',
                '#729fcf','#3465a4','#204a87',
                '#ad7fa8','#75507b','#5c3566',
                '#e9b96e','#c17d11','#8f5902',
                '#ef2929','#cc0000','#a40000'
            ]
        },
        'tangoaluminium': {
            name: 'Tango Aluminium',
            colors: [
                '#ffffff','#eeeeec','#d3d7cf','#babdb6',
                '#888a85','#555753','#2e3436','#000000'
            ]
        },
        'special': {
            name: 'Special',
            colors: [
                '#00000000', ''
            ]
        }
    }


    SimplePalette.prototype.styles = `
        <style type="text/css" id="simplepalettetoolstyle">
            .simplepalettetool-wrapper {
                display: inline-block;
                position: relative;
                vertical-align: bottom;
            }
            .simplepalettetool-outer {
                padding: 0.3em;
                background: #ddd;
                border: 1px solid #999;
                border-radius: 2px;
                box-shadow: inset 1px 1px 1px rgba(255,255,255,0.8),
                            inset -1px -1px 1px rgba(0,0,0,0.4);
                cursor: pointer;
            }
            .simplepalettetool-outer:active {
                box-shadow: inset -1px -1px 1px rgba(255,255,255,0.8),
                            inset 1px 1px 1px rgba(0,0,0,0.4);
            }
            .simplepalettetool-inner {
                background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+");
            }
            .simplepalettetool-preview {
                min-width: 2em;
                min-height: 1em;
                border: 1px solid #555;
            }
            .simplepalettetool-preview.color_is_none::before {
                content: "\u00d7";
                color: #111;
                font-size: 13px;
                display: block;
                text-align: center;
            }
            .simplepalettetool-dialog {
                display: none;
                z-index: 100;
                position: absolute;
                left: 0;
                min-width: 0px;
                min-height: 0px;
                background-color: #ddd;
                border: 1px solid #aaa;
                box-shadow: 5px 5px 10px rgba(0,0,0,0.3);
            }
            .simplepalettetool-dialog.simplepalettetool-side-up {
                bottom: 0;
                margin-bottom: 2em;
            }
            .simplepalettetool-dialog.simplepalettetool-show {
                display: block;
                padding: 4px;
            }
            .simplepalettetool-input.simplepalettetool-hidden {
                display: none;
            }
            .simplepalettetool-palette {
                display: grid;
                grid-template-column: repeat(10, 10px);
                background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+");
            }
            .simplepalettetool-palette-wrapper {

            }
            .simplepalettetool-palette-title {
                font-family: sans-serif;
                font-size: 70%;
            }
            .simplepalettetool-color {
                height: 20px;
                min-width: 20px;
                cursor: pointer;
                text-align: center;
                line-height: 20px;
            }
            .simplepalettetool-color:hover {
                box-shadow: inset 0 0 0 2px #222;
            }
            .simplepalettetool-color.simplepalettetool-isdark:hover {
                box-shadow: inset 0 0 0 2px #ddd;
            }
            .simplepalettetool-color.simplepalettetool-currentcolor::before {
                content: "\u2714";
                color: #111;
                font-size: 13px;
            }
            .simplepalettetool-color.simplepalettetool-currentcolor.simplepalettetool-isdark::before {
                color: #ffffff;
            }
            .simplepalettetool-color.color_is_none::before {
                content: "\u00d7";
                color: #111!important;
                font-size: 13px;
            }
        </style>
    `;
})(jQuery);
