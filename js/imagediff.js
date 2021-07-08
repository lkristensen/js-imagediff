(function (name, definition) {
  var root = this;
  if (typeof module !== 'undefined') {
    var createCanvas;
    try {
      Canvas = require('canvas');
    } catch (e) {}
    module.exports = definition(root, name, Canvas);
  } else if (typeof define === 'function' && typeof define.amd === 'object') {
    define(definition(root, name));
  } else {
    root[name] = definition(root, name);
  }
})('imagediff', function (root, name, Canvas) {

  var
    TYPE_ARRAY        = /\[object Array\]/i,
    TYPE_CANVAS       = /\[object (Canvas|HTMLCanvasElement)\]/i,
    TYPE_CONTEXT      = /\[object CanvasRenderingContext2D\]/i,
    TYPE_IMAGE        = /\[object (Image|HTMLImageElement)\]/i,
    TYPE_IMAGE_DATA   = /\[object ImageData\]/i,

    UNDEFINED         = 'undefined',

    canvas            = getCanvas(),
    context           = canvas.getContext('2d'),
    previous          = root[name],
    imagediff, jasmine;

  // Creation
  function getCanvas (width, height) {
    var canvas;
    if (Canvas) {
      canvas = Canvas.createCanvas(width, height);
    } else if (root.document && root.document.createElement) {
      canvas = document.createElement('canvas');
      if (width) canvas.width = width;
      if (height) canvas.height = height;
    } else {
      throw new Error(
        e.message + '\n' +
        'Please see https://github.com/HumbleSoftware/js-imagediff#cannot-find-module-canvas\n'
      );
    }
    return canvas;
  }
  function getImageData (width, height) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    return context.createImageData(width, height);
  }

  // expose canvas module
  function getCanvasRef() {
    return Canvas;
  }


  // Type Checking
  function isImage (object) {
    return isType(object, TYPE_IMAGE);
  }
  function isCanvas (object) {
    return isType(object, TYPE_CANVAS);
  }
  function isContext (object) {
    return isType(object, TYPE_CONTEXT);
  }
  function isImageData (object) {
    return !!(object &&
      isType(object, TYPE_IMAGE_DATA) &&
      typeof(object.width) !== UNDEFINED &&
      typeof(object.height) !== UNDEFINED &&
      typeof(object.data) !== UNDEFINED);
  }
  function isImageType (object) {
    return (
      isImage(object) ||
      isCanvas(object) ||
      isContext(object) ||
      isImageData(object)
    );
  }
  function isType (object, type) {
    return typeof (object) === 'object' && !!Object.prototype.toString.apply(object).match(type);
  }


  // Type Conversion
  function copyImageData (imageData) {
    var
      height = imageData.height,
      width = imageData.width,
      data = imageData.data,
      newImageData, newData, i;

    canvas.width = width;
    canvas.height = height;
    newImageData = context.getImageData(0, 0, width, height);
    newData = newImageData.data;

    for (i = imageData.data.length; i--;) {
        newData[i] = data[i];
    }

    return newImageData;
  }
  function toImageData (object) {
    if (isImage(object)) { return toImageDataFromImage(object); }
    if (isCanvas(object)) { return toImageDataFromCanvas(object); }
    if (isContext(object)) { return toImageDataFromContext(object); }
    if (isImageData(object)) { return object; }
  }
  function toImageDataFromImage (image) {
    var
      height = image.height,
      width = image.width;
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height);
  }
  function toImageDataFromCanvas (canvas) {
    var
      height = canvas.height,
      width = canvas.width,
      context = canvas.getContext('2d');
    return context.getImageData(0, 0, width, height);
  }
  function toImageDataFromContext (context) {
    var
      canvas = context.canvas,
      height = canvas.height,
      width = canvas.width;
    return context.getImageData(0, 0, width, height);
  }
  function toCanvas (object) {
    var
      data = toImageData(object),
      canvas = getCanvas(data.width, data.height),
      context = canvas.getContext('2d');

    context.putImageData(data, 0, 0);
    return canvas;
  }
  function toURIImage (object) {
    var
       canvas = toCanvas(object);
       img = document.createElement("img");
       img.setAttribute("src", canvas.toDataURL('image/png'));
       return img;
  }


  // ImageData Equality Operators
  function equalWidth (a, b) {
    return a.width === b.width;
  }
  function equalHeight (a, b) {
    return a.height === b.height;
  }
  function equalDimensions (a, b) {
    return equalHeight(a, b) && equalWidth(a, b);
  }
  function equal (a, b, tolerance, pixelDeviation) {
    var
      aData     = a.data,
      bData     = b.data,
      length    = aData.length,
      count     = 0,
      i;

    tolerance = tolerance || 0;
    pixelDeviation = pixelDeviation || 0;

    if (!equalDimensions(a, b)) {
      return false;
    }

    for (i = length; i--;) {
      if (aData[i] !== bData[i] && 
        Math.abs(aData[i] - bData[i]) > tolerance
      ) {
        count += 1;
        if(count > pixelDeviation) {
          return false;
        }
      }
    } 

    return true;
  }


  // Diff
  function diff (a, b, options) {
    return (equalDimensions(a, b) ? diffEqual : diffUnequal)(a, b, options);
  }
  function diffEqual (a, b, options) {
    var
      height  = a.height,
      width   = a.width,
      c       = getImageData(width, height), // c = a - b
      aData   = a.data,
      bData   = b.data,
      cData   = c.data,
      length  = cData.length,
      row, column,
      i, j, k, v;

    for (i = 0; i < length; i += 4) {
      /*if (aData[i] !== bData[i] || aData[i+1] !== bData[i+1] || aData[i+2] !== bData[i+2] || aData[i+3] !== bData[i+3]) {
        let diff = Math.max(Math.abs(aData[i] - bData[i]), Math.abs(aData[i+1] - bData[i+1]),Math.abs(aData[i+2] - bData[i+2]));
        if (diff < 20) {
          cData[i] = 255;
          cData[i+1] = diff;
          cData[i+2] = diff;
          cData[i+3] = Math.abs(255 - Math.abs(aData[i+3] + bData[i+3]));
        } else {
          cData[i] = diff;
          cData[i+1] = 255;
          cData[i+2] = diff;
          cData[i+3] = Math.abs(255 - Math.abs(aData[i+3] + bData[i+3]));
        }
      } else {
        cData[i] = 0;
        cData[i+1] = 0;
        cData[i+2] = 0;
        cData[i+3] = 255;
      }*/


      cData[i] = Math.abs(aData[i] - bData[i]);
      cData[i+1] = Math.abs(aData[i+1] - bData[i+1]);
      cData[i+2] = Math.abs(aData[i+2] - bData[i+2]);
      cData[i+3] = Math.abs(255 - Math.abs(aData[i+3] + bData[i+3]));
/*
      if (aData[i] === bData[i] && aData[i+1] === bData[i+1] && aData[i+2] === bData[i+2] && aData[i+3] !== bData[i+3]) {
        cData[i] = 255;
        cData[i+1] = 255;
        cData[i+2] = 255;
        cData[i+3] = 255;
      }
*/
    }

    return c;
  }
  function diffUnequal (a, b, options) {

    var
      height  = Math.max(a.height, b.height),
      width   = Math.max(a.width, b.width),
      c       = getImageData(width, height), // c = a - b
      aData   = a.data,
      bData   = b.data,
      cData   = c.data,
      align   = options && options.align,
      rowOffset,
      columnOffset,
      row, column,
      i, j, k, v;


    for (i = cData.length - 1; i > 0; i = i - 4) {
      cData[i] = 255;
    }

    // Add First Image
    offsets(a);
    for (row = a.height; row--;){
      for (column = a.width; column--;) {
        i = 4 * ((row + rowOffset) * width + (column + columnOffset));
        j = 4 * (row * a.width + column);
        cData[i+0] = aData[j+0]; // r
        cData[i+1] = aData[j+1]; // g
        cData[i+2] = aData[j+2]; // b
        cData[i+3] = aData[j+3]; // a
      }
    }

    // Subtract Second Image
    offsets(b);
    for (row = b.height; row--;){
      for (column = b.width; column--;) {
        i = 4 * ((row + rowOffset) * width + (column + columnOffset));
        j = 4 * (row * b.width + column);

        cData[i+0] = Math.abs(cData[i+0] - bData[j+0]); // r
        cData[i+1] = Math.abs(cData[i+1] - bData[j+1]); // g
        cData[i+2] = Math.abs(cData[i+2] - bData[j+2]); // b
        cData[i+3] = Math.abs(cData[i+3] - bData[j+3]); // a
      }
    }

    // Helpers
    function offsets (imageData) {
      if (align === 'top') {
        rowOffset = 0;
        columnOffset = 0;
      } else {
        rowOffset = Math.floor((height - imageData.height) / 2);
        columnOffset = Math.floor((width - imageData.width) / 2);
      }
    }

    return c;
  }


  // Validation
  function checkType () {
    var i;
    for (i = 0; i < arguments.length; i++) {
      if (!isImageType(arguments[i])) {
        throw {
          name : 'ImageTypeError',
          message : 'Submitted object was not an image.'
        };
      }
    }
  }


  // Jasmine Matchers
  function get (element, content) {
    element = document.createElement(element);
    if (element && content) {
      element.innerHTML = content;
    }
    return element;
  }

  function formatImageDiffEqualReport (actual, expected) {
    if (typeof (document) !== 'undefined') {
      return formatImageDiffEqualHtmlReport(actual, expected);
    } else {
      return formatImageDiffEqualTextReport(actual, expected);
    }
  }

  function formatImageDiffEqualHtmlReport (actual, expected) {
    var
      clear1  = document.createElement("div"),
      clear2  = document.createElement("div"),
      div     = get('div', '<span>Expected to be equal.'),
      a       = get('div', '<div>Actual:</div>'),
      b       = get('div', '<div>Expected:</div>'),
      c       = get('div', '<div>Diff:</div>'),
      diff    = imagediff.diff(actual, expected),
      canvas  = getCanvas(),
      context;

    clear1.classList.add("clearfix");
    clear2.classList.add("clearfix");

    canvas.height = diff.height;
    canvas.width  = diff.width;

    div.style.overflow = 'hidden';
    a.style.float = 'left';
    b.style.float = 'left';
    c.style.float = 'left';

    context = canvas.getContext('2d');
    context.putImageData(diff, 0, 0);
    a.appendChild(toURIImage(actual));
    b.appendChild(toURIImage(expected));
    c.appendChild(toURIImage(canvas));

    div.appendChild(clear1);
    div.appendChild(a);
    div.appendChild(b);
    div.appendChild(c);
    div.appendChild(clear2);

    return div.innerHTML;
  }

  function formatImageDiffEqualTextReport (actual, expected) {
    return 'Expected to be equal.';
  }

  jasmine = {
    toBeImageData : function () {
      return {
        compare: function (actual, expected) {
          var pass = imagediff.isImageData(actual);
          return {
            pass: pass,
            message: pass ? 'Is ImageData' : 'Is not ImageData'
          };
        }
      };
    },

    toImageDiffEqual : function () {
      return {
        compare: function (actual, expected, tolerance, pixelDeviation) {
          var pass = imagediff.equal(actual, expected, tolerance, pixelDeviation);

          return {
            pass: pass,
            message: pass ? 'Expected not to be equal.' : formatImageDiffEqualReport(actual, expected)
          };
        }
      };
    }
  };


  // Image Output
  function imageDataToPNG (imageData, outputFile, callback) {

    var
      canvas = toCanvas(imageData),
      base64Data,
      decodedImage;

    callback = callback || Function;

    base64Data = canvas.toDataURL().replace(/^data:image\/\w+;base64,/,"");
    decodedImage = Buffer.from(base64Data, 'base64');
    require('fs').writeFile(outputFile, decodedImage, callback);
  }


  // Definition
  imagediff = {

    createCanvas : getCanvas,
    createImageData : getImageData,
    getCanvasRef : getCanvasRef,

    isImage : isImage,
    isCanvas : isCanvas,
    isContext : isContext,
    isImageData : isImageData,
    isImageType : isImageType,

    toImageData : function (object) {
      checkType(object);
      if (isImageData(object)) { return copyImageData(object); }
      return toImageData(object);
    },

    equal : function (a, b, tolerance, pixelDeviation) {
      checkType(a, b);
      a = toImageData(a);
      b = toImageData(b);
      return equal(a, b, tolerance, pixelDeviation);
    },
    diff : function (a, b, options) {
      checkType(a, b);
      a = toImageData(a);
      b = toImageData(b);
      return diff(a, b, options);
    },

    jasmine : jasmine,

    // Compatibility
    noConflict : function () {
      root[name] = previous;
      return imagediff;
    }
  };

  if (typeof module !== 'undefined') {
    imagediff.imageDataToPNG = imageDataToPNG;
  }

  return imagediff;
});
