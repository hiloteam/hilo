/**
 * Hilo 1.0.2 for cmd
 * Copyright 2016 alibaba.com
 * Licensed under the MIT License
 */
define(function(require, exports, module){

var Class = require('hilo/core/Class');
var Hilo = require('hilo/core/Hilo');
var View = require('hilo/view/View');
var CacheMixin = require('hilo/view/CacheMixin');



/**
 * @language=en
 * <iframe src='../../../examples/Text.html?noHeader' width = '320' height = '240' scrolling='no'></iframe>
 * <br/>
 * @class Text class provide basic text-display function, use DOMElement for complex text-display.
 * @augments View
 * @mixes CacheMixin
 * @borrows CacheMixin#cache as #cache
 * @borrows CacheMixin#updateCache as #updateCache
 * @borrows CacheMixin#setCacheDirty as #setCacheDirty
 * @param {Object} properties Properties parameters for the object. Includes all writable properties.
 * @module hilo/view/Text
 * @requires hilo/core/Class
 * @requires hilo/core/Hilo
 * @requires hilo/view/View
 * @requires hilo/view/CacheMixin
 * @property {String} text Text to display.
 * @property {String} color Color of the text.
 * @property {String} textAlign Horizontal alignment way of the text. May be one of the following value:'start', 'end', 'left', 'right', and 'center'. Note:Need to specify the width property of the text to take effect
 * @property {String} textVAlign Vertical alignment way of the text. May be one of the following value:'top', 'middle', 'bottom'. Note:Need to specify the height property of the text to take effect.
 * @property {Boolean} outline Draw the outline of the text or fill the text.
 * @property {Number} lineSpacing The spacing between lines. Measured in px, default value is 0.
 * @property {Number} maxWidth The max length of the text, default value is 200.
 * @property {String} font Text's CSS font style, readonly! Use setFont function to set text font.
 * @property {Number} textWidth Width of the text, readonly! Works only on canvas mode.
 * @property {Number} textHeight Height of the text, readonly! Works only on canvas mode.
 */
var Text = Class.create(/** @lends Text.prototype */{
    Extends: View,
    Mixes: CacheMixin,
    constructor: function (properties) {
        properties = properties || {};
        this.id = this.id || properties.id || Hilo.getUid('Text');
        Text.superclass.constructor.call(this, properties);

        // if(!properties.width) this.width = 200; //default width
        if (!properties.font) this.font = '12px arial'; //default font style
    },

    text: null,
    color: '#000',
    textAlign: null,
    textVAlign: null,
    outline: false,
    lineSpacing: 0,
    maxWidth: 200,
    font: null, //ready-only
    textWidth: 0, //read-only
    textHeight: 0, //read-only
    _props: null,
    _wordWidthCache: {},

    /**
     * @language=en
     * Set text CSS font style.
     * @param {String} font Text CSS font style to set.
     * @returns {Text} the Text object, chained call supported.
     */
    setFont: function (font) {
        var me = this;
        if (me.font !== font) {
            me.font = font;
            me._props = null;
            me._wordWidthCache = {};

            // delay the update cache
            // so you can set text properties after text.setFont call
            setTimeout(function(){
                me.cache();
            },0);
        }

        return me;
    },

    /**
     * @language=en
     * Overwrite render function.
     * @private
     */
    render: function (renderer, delta) {
        var me = this;

        if (renderer.renderType === 'canvas') {
            if (me._cacheDirty) {
                me._draw(renderer.context);
            } else {
                // we should use cache to draw to improve performance
                renderer.draw(me);
            }
        }
        else if (renderer.renderType === 'dom') {
            var drawable = me.drawable;
            var domElement = drawable.domElement;
            var style = domElement.style;

            style.font = me.font;
            style.textAlign = me.textAlign;
            style.color = me.color;
            style.width = me.width + 'px';
            style.height = me.height + 'px';
            style.lineHeight = (me._fontHeight + me.lineSpacing) + 'px';

            renderer.draw(this);

            // when support canvas and cache = true, 
            // we cache text into a image, 
            // so dont need to set innerHTML again
            if(me._cacheDirty){
                domElement.style.backgroundImage = '';
                domElement.innerHTML = me.text;
            }else{
                domElement.innerHTML = '';
            }
        }
        else {
            renderer.draw(me);
        }
    },
    /**
     * @language=en
     * overwrite CacheMixin cache method.
     * @param {Boolean} forceUpdate is force update cache.
     */
    cache: function(forceUpdate){
        var me = this;
        if(forceUpdate || me._cacheDirty || !me._cacheImage){
            if(Hilo.browser.supportCanvas){
                me._cacheCanvas = document.createElement('canvas');
                me._cacheContext = me._cacheCanvas.getContext('2d');
                me._setDrawingStyle(me._cacheContext);

                var props = me._getTextProps(me._cacheContext, me.text);
                me._cacheCanvas.width = props.width;
                me._cacheCanvas.height = props.height;
                me._props = props;
            }

            me.updateCache();
        }
        
        me._cacheDirty = !forceUpdate;
    },

    /**
     * @language=en
     * Draw text under the assigned render context.
     * @private
     */
    _draw: function (context) {
        var me = this, text = me.text.toString();
        if (!text) return;

        me._setDrawingStyle(context);

        if(!this._props){
            this._props = this._getTextProps(context, text);
        }

        var drawLines = this._props.drawLines;
        var width = this._props.width;
        var height = this._props.height;

        me.textWidth = width;
        me.textHeight = height;
        if (!me.width) me.width = width;
        if (!me.height) me.height = height;

        //vertical alignment
        var startY = 0;
        switch (me.textVAlign) {
            case 'middle':
                startY = me.height - me.textHeight >> 1;
                break;
            case 'bottom':
                startY = me.height - me.textHeight;
                break;
        }

        //draw background
        var bg = me.background;
        if (bg) {
            context.fillStyle = bg;
            context.fillRect(0, 0, me.width, me.height);
        }

        if (me.outline) context.strokeStyle = me.color;
        else context.fillStyle = me.color;

        //draw text lines
        for (var i = 0; i < drawLines.length; i++) {
            var line = drawLines[i];
            me._drawTextLine(context, line.text, startY + line.y);
        }
    },

    /**
     * @language=en
     * Draw a line of text under the assigned render context.
     * @private
     */
    _drawTextLine: function (context, text, y) {
        var me = this, x = 0, width = me.width;

        switch (me.textAlign) {
            case 'center':
                x = width >> 1;
                break;
            case 'right':
            case 'end':
                x = width;
                break;
        }

        if (me.outline) context.strokeText(text, x, y);
        else context.fillText(text, x, y);
    },
    /**
     * @language=en
     * set drawing style
     * @private
     */
    _setDrawingStyle: function(context){
        //set drawing style
        var me = this;
        context.font = me.font;
        context.textAlign = me.textAlign;
        context.textBaseline = 'top';
    },
     /**
     * @language=en
     * get the text properties(width, height, line)
     * @private
     * @return {} return the text properties。
     */
    _getTextProps: function(context, text){
        var me = this;
        me._fontHeight = this._measureFontHeight();

        //find and draw all explicit lines
        var lines = text.split(/\r\n|\r|\n|<br(?:[ \/])*>/);
        var width = 0, height = 0;
        var lineHeight = me._fontHeight + me.lineSpacing;
        var i, line, w, len, wlen;
        var drawLines = [];

        for (i = 0, len = lines.length; i < len; i++) {
            line = lines[i];
            w = me._measureTextWidth(context, text);

            //check if the line need to split
            if (w <= me.maxWidth) {
                drawLines.push({text: line, y: height});
                // me._drawTextLine(context, line, height);
                if (width < w) width = w;
                height += lineHeight;
                continue;
            }

            var str = '', oldWidth = 0, newWidth, j, word;

            for (j = 0, wlen = line.length; j < wlen; j++) {
                word = line[j];
                newWidth = me._measureTextWidth(context, str + word);

                if (newWidth > me.maxWidth) {
                    drawLines.push({text: str, y: height});
                    // me._drawTextLine(context, str, height);
                    if (width < oldWidth) width = oldWidth;
                    height += lineHeight;
                    str = word;
                } else {
                    oldWidth = newWidth;
                    str += word;
                }

                if (j == wlen - 1) {
                    drawLines.push({text: str, y: height});
                    // me._drawTextLine(context, str, height);
                    if (str !== word && width < newWidth) width = newWidth;
                    height += lineHeight;
                }
            }
        }

        return {
            drawLines: drawLines,
            width: width,
            height: height
        };
    },
     /**
     * @language=en
     * Measure the char width of text
     * @private
     * @return {Number} Return char width
     */
    _measureTextWidth: function(context, text){
        var width = 0;

        for (var i = 0, len = text.length; i < len; i += 1) {
            var char = text[i];
            if (this._wordWidthCache[char]) {
                width += this._wordWidthCache[char];
            } else {
                width += context.measureText(char).width;
            }
        }

        return width;
    },
    /**
     * @language=en
     * Measure the line height of the assigned text font style.
     * @private
     * @return {Number} Return line height of the assigned font style.
     */
    _measureFontHeight: function () {
        var me = this;
        var fontHeight = 0;
        
        if (false){//Hilo.browser.supportCanvas) {
            var canvas = me._cacheCanvas;
            var context = me._cacheContext;

            if (!canvas) {
                canvas = this._cacheCanvas = document.createElement('canvas');
                context = this._cacheContext = this._cacheCanvas.getContext('2d');
            }

            var width = Math.ceil(context.measureText('|MÉq').width);
            var baseline = Math.ceil(context.measureText('M').width);
            var height = 2 * baseline;

            baseline = baseline * 1.4 | 0;

            canvas.width = width;
            canvas.height = height;

            context.fillStyle = '#f00';
            context.fillRect(0, 0, width, height);

            context.font = this.font;

            context.textBaseline = 'alphabetic';
            context.fillStyle = '#000';
            context.fillText('|MÉq', 0, baseline);

            var imagedata = context.getImageData(0, 0, width, height).data;
            var pixels = imagedata.length;
            var line = width * 4;

            var i = 0;
            var j = 0;
            var idx = 0;
            var stop = false;

            // scan pixel to find text ascent
            for (i = 0; i < baseline; ++i) {
                for (j = 0; j < line; j += 4) {
                    if (imagedata[idx + j] !== 255) {
                        stop = true;
                        break;
                    }
                }

                if (!stop) {
                    idx += line;
                } else {
                    break;
                }
            }

            var ascent = baseline - i;

            idx = pixels - line;
            stop = false;

            // scan pixel to find text descent.
            for (i = height; i > baseline; --i) {
                for (j = 0; j < line; j += 4) {
                    if (imagedata[idx + j] !== 255) {
                        stop = true;
                        break;
                    }
                }

                if (!stop) {
                    idx -= line;
                } else {
                    break;
                }
            }

            return (i - baseline) + ascent;

        }

        return Text.measureFontHeight(me.text);
    },
    Statics: /** @lends Text */{
        /**
         * @language=en
         * Measure the line height of the assigned text font style.
         * @param {String} font Font style to measure.
         * @return {Number} Return line height of the assigned font style.
         */
        measureFontHeight: function(text){
            var docElement = document.documentElement;
            var elem = Hilo.createElement('div', {style: {font: this.font, position: 'absolute'}, innerHTML: '|MÉq'});

            docElement.appendChild(elem);
            fontHeight = elem.offsetHeight;
            docElement.removeChild(elem);

            return fontHeight;
        }
    }
});


return Text;

});