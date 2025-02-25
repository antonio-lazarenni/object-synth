import type p5 from 'p5';

class VidaBlob {
  public normRectX: number = 0.0;
  public normRectY: number = 0.0;
  public normRectW: number = 0.0;
  public normRectH: number = 0.0;
  public normMassCenterX: number = 0.0;
  public normMassCenterY: number = 0.0;
  public normMass: number = 0.0;
  public approximatedPolygon: any[] = [];
  public creationTime: number;
  public creationFrameCount: number;
  public id: number = -1;
  public __rawId: number = -1;
  public isNewFlag: boolean = true;

  constructor() {
    this.creationTime = Date.now();
    this.creationFrameCount = 0; // Will be set by Vida class
  }
}

class VidaActiveZone {
  public normX: number;
  public normY: number;
  public normW: number;
  public normH: number;
  public isEnabledFlag: boolean;
  public isMovementDetectedFlag: boolean;
  public isChangedFlag: boolean;
  public changedTime: number;
  public changedFrameCount: number;
  public normFillFactor: number;
  public normFillThreshold: number;
  public id: number;
  public onChange: (zone: VidaActiveZone) => void;

  constructor(
    _id: number,
    _normX: number,
    _normY: number,
    _normW: number,
    _normH: number,
    _onChangeCallbackFunction: (zone: VidaActiveZone) => void
  ) {
    this.normX = _normX;
    this.normY = _normY;
    this.normW = _normW;
    this.normH = _normH;
    this.isEnabledFlag = true;
    this.isMovementDetectedFlag = false;
    this.isChangedFlag = false;
    this.changedTime = 0;
    this.changedFrameCount = 0;
    this.normFillFactor = 0.0;
    this.normFillThreshold = 0.02;
    this.id = _id;
    this.onChange = _onChangeCallbackFunction;
  }
}

class Vida {
  private p: p5;
  public MIRROR_NONE: number;
  public MIRROR_VERTICAL: number;
  public MIRROR_HORIZONTAL: number;
  public MIRROR_BOTH: number;
  public mirror: number;
  public progressiveBackgroundFlag: boolean;
  public currentImage: any;
  public backgroundImage: any;
  public differenceImage: any;
  public thresholdImage: any;
  public imageFilterFeedback: number;
  public imageFilterThreshold: number;
  private __automaticPixelsDataTransferFlag: boolean;
  public lastUpdateTime: number;
  public lastUpdateFrameCount: number;
  private __activeZonesNormFillThreshold: number;
  public handleActiveZonesFlag: boolean;
  public activeZones: any[];
  private __currentBlobsLocation: number;
  private __previousBlobsLocation: number;
  private __blobs: any[][];
  public handleBlobsFlag: boolean;
  public REJECT_NONE_BLOBS: number;
  public REJECT_INNER_BLOBS: number;
  public REJECT_OUTER_BLOBS: number;
  public rejectBlobsMethod: number;
  public trackBlobsFlag: boolean;
  public trackBlobsMaxNormDist: number;
  public normMinBlobMass: number;
  public normMaxBlobMass: number;
  public normMinBlobArea: number;
  public normMaxBlobArea: number;
  public approximateBlobPolygonsFlag: boolean;
  public pointsPerApproximatedBlobPolygon: number;
  private __blobMapArray: any[][];
  public numberOfDetectedBlobs: number;

  constructor(p: p5) {
    this.p = p;
    this.MIRROR_NONE = 0;
    this.MIRROR_VERTICAL = 1;
    this.MIRROR_HORIZONTAL = 2;
    this.MIRROR_BOTH = 3;
    this.mirror = this.MIRROR_NONE;
    this.progressiveBackgroundFlag = !0;
    this.currentImage = p.createGraphics(10, 10);
    this.backgroundImage = p.createImage(10, 10);
    this.differenceImage = p.createImage(10, 10);
    this.thresholdImage = p.createImage(10, 10);
    this.imageFilterFeedback = 0.92;
    this.imageFilterThreshold = 0.4;
    this.__automaticPixelsDataTransferFlag = !0;
    this.lastUpdateTime = 0;
    this.lastUpdateFrameCount = 0;
    this.__activeZonesNormFillThreshold = 0.02;
    this.handleActiveZonesFlag = !1;
    this.activeZones = [];
    this.__currentBlobsLocation = 0;
    this.__previousBlobsLocation = 1;
    this.__blobs = [[], []];
    this.handleBlobsFlag = !1;
    this.REJECT_NONE_BLOBS = 0;
    this.REJECT_INNER_BLOBS = 1;
    this.REJECT_OUTER_BLOBS = 2;
    this.rejectBlobsMethod = this.REJECT_NONE_BLOBS;
    this.trackBlobsFlag = !1;
    this.trackBlobsMaxNormDist = 0.15;
    this.normMinBlobMass = 0.0002;
    this.normMaxBlobMass = 0.5;
    this.normMinBlobArea = 0.0002;
    this.normMaxBlobArea = 0.5;
    this.approximateBlobPolygonsFlag = !1;
    this.pointsPerApproximatedBlobPolygon = 6;
    this.__blobMapArray = [];
    this.numberOfDetectedBlobs = 0;
    this.resizeBlobMapArray(
      this.thresholdImage.width,
      this.thresholdImage.height
    );
  }

  public resizeGraphicsWorkaround(_g: any, _w: number, _h: number) {
    // Create a new graphics buffer with the desired dimensions
    const newG = this.p.createGraphics(_w, _h);
    newG.pixelDensity(1);
    newG.elt.setAttribute('style', 'display: none');
    newG.updatePixels();
    newG.background(0);
    newG.loadPixels();
    
    if (_w * _h !== newG.pixels.length / 4) {
      console.log(
        '[Vida, resizeGraphicsWorkaround] _w * _h !== _g.pixels.length / 4:' +
          '\n_w = ' +
          _w +
          ' _h = ' +
          _h +
          '\n_g.width = ' +
          newG.width +
          ' _g.height = ' +
          newG.height +
          '\n_w * _h = ' +
          _w * _h +
          '\n_g.pixels.length / 4 = ' +
          newG.pixels.length / 4
      );
    }
    
    return newG;
  }
  public getBlobs(_location: number) {
    if (arguments.length === 0) _location = this.__currentBlobsLocation;
    else if (
      _location !== this.__currentBlobsLocation &&
      _location !== this.__previousBlobsLocation
    ) {
      console.log(
        '[Vida, getBlobs] Unhandled _location parameter value: ' +
          _location +
          '. The _location value will be change to ' +
          this.__currentBlobsLocation +
          ' (' +
          this.__currentBlobsLocation +
          ').'
      );
      _location = this.__currentBlobsLocation;
    }
    return this.__blobs[_location];
  }
  public getCurrentBlobsLocation() {
    return this.__currentBlobsLocation;
  }
  public getPreviousBlobsLocation() {
    return this.__previousBlobsLocation;
  }
  public resizeBlobMapArray(_w: number, _h: number) {
    this.__blobMapArray.splice(0, this.__blobMapArray.length);
    for (var x = 0; x < _w; x++) {
      var temp_column_array = [];
      for (var y = 0; y < _h; y++) temp_column_array[y] = 0;
      this.__blobMapArray[x] = temp_column_array;
    }
  }
  public resetBlobMapArray() {
    for (var y = 0; y < this.thresholdImage.height; y++)
      for (var x = 0; x < this.thresholdImage.width; x++)
        this.__blobMapArray[x][y] = 0;
  }
  public hitTestThresholdImage(_norm_x: number, _norm_y: number) {
    var temp_coord_x = Math.floor(_norm_x * this.thresholdImage.width);
    var temp_coord_y = Math.floor(_norm_y * this.thresholdImage.height);
    if (temp_coord_x < 0.0) return !1;
    if (temp_coord_y < 0.0) return !1;
    if (temp_coord_x >= this.thresholdImage.width) return !1;
    if (temp_coord_y >= this.thresholdImage.height) return !1;
    var temp_pixel_position =
      (temp_coord_y * this.thresholdImage.width + temp_coord_x) * 4;
    if (this.thresholdImage.pixels[temp_pixel_position] > 0) return !0;
    return !1;
  }
  public setActiveZonesNormFillThreshold(_v: number) {
    if (_v < 0.0) _v = 0.0;
    if (_v > 1.0) _v = 1.0;
    this.__activeZonesNormFillThreshold = _v;
    for (var i = 0; i < this.activeZones.length; i++)
      this.activeZones[i].normFillThreshold =
        this.__activeZonesNormFillThreshold;
  }
  public getActiveZonesNormFillThreshold() {
    return this.__activeZonesNormFillThreshold;
  }
  public addActiveZone(
    _id: number,
    _normX: number,
    _normY: number,
    _normW: number,
    _normH: number,
    _onChangeCallbackFunction: (zone: VidaActiveZone) => void
  ) {
    if (arguments.length === 5) {
      _onChangeCallbackFunction = function (_activeZone: VidaActiveZone) {};
    }
    for (let i = 0; i < this.activeZones.length; i++)
      if (_id == this.activeZones[i].id)
        console.log(
          '[Vida, addActiveZone] There are already active zones with the same' +
            ' id: ' +
            _id
        );
    if (
      _onChangeCallbackFunction === null ||
      _onChangeCallbackFunction === undefined
    )
      _onChangeCallbackFunction = function (_activeZone: VidaActiveZone) {};
    this.activeZones[this.activeZones.length] = new VidaActiveZone(
      _id,
      _normX,
      _normY,
      _normW,
      _normH,
      _onChangeCallbackFunction
    );
  }
  public drawBlobs(_x: number, _y: number, _w: number, _h: number) {
    if (arguments.length === 2) {
      _w = this.thresholdImage.width;
      _h = this.thresholdImage.height;
    }
    var temp_rect_x,
      temp_rect_y,
      temp_rect_w,
      temp_rect_h,
      temp_mass_center_x,
      temp_mass_center_y;
    this.p.push();
    this.p.translate(_x, _y);
    this.p.textFont('Helvetica', 10);
    this.p.textAlign(this.p.LEFT, this.p.BOTTOM);
    this.p.textStyle(this.p.NORMAL);
    for (var i = 0; i < this.__blobs[this.__currentBlobsLocation].length; i++) {
      temp_rect_x = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normRectX * _w
      );
      temp_rect_y = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normRectY * _h
      );
      temp_rect_w = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normRectW * _w
      );
      temp_rect_h = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normRectH * _h
      );
      temp_mass_center_x = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterX * _w
      );
      temp_mass_center_y = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterY * _h
      );
      this.p.strokeWeight(1);
      this.p.stroke(255, 255, 0);
      this.p.noFill();
      this.p.rect(temp_rect_x, temp_rect_y, temp_rect_w, temp_rect_h);
      this.p.noStroke();
      this.p.fill(255, 0, 0);
      this.p.ellipseMode(this.p.CENTER);
      this.p.ellipse(temp_mass_center_x, temp_mass_center_y, 3, 3);
      this.p.noStroke();
      this.p.fill(255, 255, 0);
      this.p.text(
        this.__blobs[this.__currentBlobsLocation][i].id,
        temp_rect_x,
        temp_rect_y - 1
      );
      this.p.strokeWeight(1);
      this.p.stroke(255, 0, 0);
      this.p.noFill();
      this.p.beginShape();
      for (
        var j = 0;
        j <
        this.__blobs[this.__currentBlobsLocation][i].approximatedPolygon.length;
        j++
      ) {
        this.p.vertex(
          this.__blobs[this.__currentBlobsLocation][i].approximatedPolygon[j]
            .normX * _w,
          this.__blobs[this.__currentBlobsLocation][i].approximatedPolygon[j]
            .normY * _h
        );
      }
      this.p.endShape(this.p.CLOSE);
    }
    this.p.pop();
  }
  public drawActiveZones(_x: number, _y: number, _w: number, _h: number) {
    if (arguments.length === 2) {
      _w = this.thresholdImage.width;
      _h = this.thresholdImage.height;
    }
    var temp_coord_x, temp_coord_y, temp_coord_w, temp_coord_h;
    this.p.push();
    this.p.textFont('Helvetica', 10);
    this.p.textAlign(this.p.LEFT, this.p.BOTTOM);
    this.p.textStyle(this.p.NORMAL);
    for (var i = 0; i < this.activeZones.length; i++) {
      temp_coord_x = Math.floor(_x + this.activeZones[i].normX * _w);
      temp_coord_y = Math.floor(_y + this.activeZones[i].normY * _h);
      temp_coord_w = Math.floor(this.activeZones[i].normW * _w);
      temp_coord_h = Math.floor(this.activeZones[i].normH * _h);
      this.p.strokeWeight(1);
      if (this.activeZones[i].isEnabledFlag) {
        this.p.stroke(255, 0, 0);
        if (this.activeZones[i].isMovementDetectedFlag)
          this.p.fill(255, 0, 0, 128);
        else this.p.noFill();
      } else {
        this.p.stroke(0, 0, 255);
        if (this.activeZones[i].isMovementDetectedFlag)
          this.p.fill(0, 0, 255, 128);
        else this.p.noFill();
      }
      this.p.rect(temp_coord_x, temp_coord_y, temp_coord_w, temp_coord_h);
      this.p.noStroke();
      if (this.activeZones[i].isEnabledFlag) this.p.fill(255, 0, 0);
      else this.p.fill(0, 0, 255);
      this.p.text(this.activeZones[i].id, temp_coord_x, temp_coord_y - 1);
    }
    this.p.pop();
  }
  public removeActiveZone(_id: number) {
    for (let i = this.activeZones.length - 1; i >= 0; i--) {
      if (_id == this.activeZones[i].id) this.activeZones.splice(i, 1);
    }
  }
  public getActiveZone(_id: number) {
    for (let i = 0; i < this.activeZones.length; i++) {
      if (_id == this.activeZones[i].id) return this.activeZones[i];
    }
    return -1;
  }
  public updateActiveZones() {
    var temp_coord_start_x,
      temp_coord_start_y,
      temp_coord_end_x,
      temp_coord_end_y,
      temp_pixel_position,
      temp_number_of_filled_pixels,
      temp_zone_area,
      temp_isMovementDetectedFlag;
    for (var i = 0; i < this.activeZones.length; i++) {
      if (!this.activeZones[i].isEnabledFlag) {
        this.activeZones[i].isChangedFlag = !1;
        this.activeZones[i].isMovementDetectedFlag = !1;
        continue;
      }
      temp_coord_start_x = Math.floor(
        this.activeZones[i].normX * this.thresholdImage.width
      );
      temp_coord_start_y = Math.floor(
        this.activeZones[i].normY * this.thresholdImage.height
      );
      temp_coord_end_x = Math.floor(
        (this.activeZones[i].normX + this.activeZones[i].normW) *
          this.thresholdImage.width
      );
      temp_coord_end_y = Math.floor(
        (this.activeZones[i].normY + this.activeZones[i].normH) *
          this.thresholdImage.height
      );
      temp_zone_area =
        Math.floor(this.activeZones[i].normW * this.thresholdImage.width) +
        Math.floor(this.activeZones[i].normH * this.thresholdImage.height);
      temp_number_of_filled_pixels = 0;
      for (var y = temp_coord_start_y; y <= temp_coord_end_y; y++) {
        for (var x = temp_coord_start_x; x <= temp_coord_end_x; x++) {
          temp_pixel_position = (y * this.thresholdImage.width + x) * 4;
          if (this.thresholdImage.pixels[temp_pixel_position] > 0)
            temp_number_of_filled_pixels += 1;
        }
      }
      this.activeZones[i].normFillFactor =
        temp_number_of_filled_pixels / temp_zone_area;
      if (
        this.activeZones[i].normFillFactor >
        this.activeZones[i].normFillThreshold
      )
        temp_isMovementDetectedFlag = !0;
      else temp_isMovementDetectedFlag = !1;
      if (
        temp_isMovementDetectedFlag !=
        this.activeZones[i].isMovementDetectedFlag
      ) {
        this.activeZones[i].isChangedFlag = !0;
        this.activeZones[i].changedTime = this.p.millis();
        this.activeZones[i].changedFrameCount = this.p.frameCount;
        this.activeZones[i].isMovementDetectedFlag =
          temp_isMovementDetectedFlag;
        this.activeZones[i].onChange(this.activeZones[i]);
      }
    }
  }
  public update(_image: p5.Element) {
    if (this.updateImageProcessor(_image)) {
      if (this.handleActiveZonesFlag) this.updateActiveZones();
      if (this.handleBlobsFlag) this.updateBlobs();
      this.lastUpdateTime = this.p.millis();
      this.lastUpdateFrameCount = this.p.frameCount;
    } else {
      console.log(
        '[Vida, update] something went wrong. Probably the ' +
          'updateImageProcessor function call failed.'
      );
    }
  }
  public setBackgroundImage(_image: p5.Element) {
    if (_image === null) {
      console.log('[Vida, setBackgroundImage] error: _image === null');
      return !1;
    }
    if (_image.width < 1 || _image.height < 1) {
      console.log(
        '[Vida, setBackgroundImage] possible error: resolution of the _image ' +
          'seems to be incorrect: _image.width = ' +
          _image.width +
          ' _image.height = ' +
          _image.height +
          '.'
      );
      return !1;
    }
    if (
      _image.width != this.backgroundImage.width ||
      _image.height != this.backgroundImage.height
    ) {
      console.log(
        '[Vida, setBackgroundImage] adjusting images size to: ' +
          _image.width +
          ' ' +
          _image.height
      );
      this.currentImage = this.resizeGraphicsWorkaround(
        this.currentImage,
        _image.width,
        _image.height
      );
      this.backgroundImage.resize(_image.width, _image.height);
      this.differenceImage.resize(_image.width, _image.height);
      this.thresholdImage.resize(_image.width, _image.height);
      this.resizeBlobMapArray(_image.width, _image.height);
    }
    if (this.__automaticPixelsDataTransferFlag) {
      (_image as any).loadPixels();
      this.backgroundImage.loadPixels();
      this.differenceImage.loadPixels();
    }
    switch (this.mirror) {
      case this.MIRROR_NONE:
        this.backgroundImage.copy(
          _image,
          0,
          0,
          _image.width,
          _image.height,
          0,
          0,
          _image.width,
          _image.height
        );
        break;
      case this.MIRROR_HORIZONTAL:
        this.currentImage.push();
        this.currentImage.scale(-1, 1);
        this.currentImage.image(_image, -this.currentImage.width, 0);
        this.currentImage.pop();
        this.backgroundImage.copy(
          this.currentImage,
          0,
          0,
          _image.width,
          _image.height,
          0,
          0,
          _image.width,
          _image.height
        );
        break;
      case this.MIRROR_VERTICAL:
        this.currentImage.push();
        this.currentImage.scale(1, -1);
        this.currentImage.image(_image, 0, -this.currentImage.height);
        this.currentImage.pop();
        this.backgroundImage.copy(
          this.currentImage,
          0,
          0,
          _image.width,
          _image.height,
          0,
          0,
          _image.width,
          _image.height
        );
        break;
      case this.MIRROR_BOTH:
        this.currentImage.push();
        this.currentImage.scale(-1, -1);
        this.currentImage.image(
          _image,
          -this.currentImage.width,
          -this.currentImage.height
        );
        this.currentImage.pop();
        this.backgroundImage.copy(
          this.currentImage,
          0,
          0,
          _image.width,
          _image.height,
          0,
          0,
          _image.width,
          _image.height
        );
        break;
      default:
        console.log(
          '[Vida, setBackgroundImage] unhandled mirror value: ' + this.mirror
        );
    }
  }
  public updateImageProcessor(_image: any) {
    if (_image === null) {
      console.log('[Vida, updateImageProcessor] error: _image === null');
      return !1;
    }
    if (_image.width < 1 || _image.height < 1) {
      console.log(
        '[Vida, updateImageProcessor] possible error: resolution of the _image ' +
          'seems to be incorrect: _image.width = ' +
          _image.width +
          ' _image.height = ' +
          _image.height +
          '.'
      );
      return !1;
    }
    if (
      _image.width != this.backgroundImage.width ||
      _image.height != this.backgroundImage.height
    ) {
      console.log(
        '[Vida, updateImageProcessor] adjusting images size to: ' +
          _image.width +
          ' ' +
          _image.height
      );
      this.currentImage = this.resizeGraphicsWorkaround(
        this.currentImage,
        _image.width,
        _image.height
      );
      this.backgroundImage.resize(_image.width, _image.height);
      this.differenceImage.resize(_image.width, _image.height);
      this.thresholdImage.resize(_image.width, _image.height);
      this.resizeBlobMapArray(_image.width, _image.height);
    }
    if (this.__automaticPixelsDataTransferFlag) {
      (_image as any).loadPixels();
      this.backgroundImage.loadPixels();
      this.differenceImage.loadPixels();
    }
    switch (this.mirror) {
      case this.MIRROR_NONE:
        this.currentImage.image(_image, 0, 0);
        break;
      case this.MIRROR_HORIZONTAL:
        this.currentImage.push();
        this.currentImage.scale(-1, 1);
        this.currentImage.image(_image, -this.currentImage.width, 0);
        this.currentImage.pop();
        break;
      case this.MIRROR_VERTICAL:
        this.currentImage.push();
        this.currentImage.scale(1, -1);
        this.currentImage.image(_image, 0, -this.currentImage.height);
        this.currentImage.pop();
        break;
      case this.MIRROR_BOTH:
        this.currentImage.push();
        this.currentImage.scale(-1, -1);
        this.currentImage.image(
          _image,
          -this.currentImage.width,
          -this.currentImage.height
        );
        this.currentImage.pop();
        break;
      default:
        console.log(
          '[Vida, updateImageProcessor] unhandled mirror value: ' + this.mirror
        );
    }
    const temp_imageFilterFeedback_flipped = 1.0 - this.imageFilterFeedback;
    if (this.__automaticPixelsDataTransferFlag) this.currentImage.loadPixels();
    if (this.progressiveBackgroundFlag) {
      for (let i = 0; i < this.backgroundImage.pixels.length; i += 4) {
        this.backgroundImage.pixels[i] =
          this.backgroundImage.pixels[i] * this.imageFilterFeedback +
          this.currentImage.pixels[i] * temp_imageFilterFeedback_flipped;
        this.backgroundImage.pixels[i + 1] =
          this.backgroundImage.pixels[i + 1] * this.imageFilterFeedback +
          this.currentImage.pixels[i + 1] * temp_imageFilterFeedback_flipped;
        this.backgroundImage.pixels[i + 2] =
          this.backgroundImage.pixels[i + 2] * this.imageFilterFeedback +
          this.currentImage.pixels[i + 2] * temp_imageFilterFeedback_flipped;
        this.backgroundImage.pixels[i + 3] = 255;
        this.differenceImage.pixels[i] = this.p.abs(
          this.backgroundImage.pixels[i] - this.currentImage.pixels[i]
        );
        this.differenceImage.pixels[i + 1] = this.p.abs(
          this.backgroundImage.pixels[i + 1] - this.currentImage.pixels[i + 1]
        );
        this.differenceImage.pixels[i + 2] = this.p.abs(
          this.backgroundImage.pixels[i + 2] - this.currentImage.pixels[i + 2]
        );
        this.differenceImage.pixels[i + 3] = 255;
      }
    } else {
      for (let i = 0; i < this.backgroundImage.pixels.length; i += 4) {
        this.differenceImage.pixels[i] = this.p.abs(
          this.backgroundImage.pixels[i] - this.currentImage.pixels[i]
        );
        this.differenceImage.pixels[i + 1] = this.p.abs(
          this.backgroundImage.pixels[i + 1] - this.currentImage.pixels[i + 1]
        );
        this.differenceImage.pixels[i + 2] = this.p.abs(
          this.backgroundImage.pixels[i + 2] - this.currentImage.pixels[i + 2]
        );
        this.differenceImage.pixels[i + 3] = 255;
      }
    }
    if (this.__automaticPixelsDataTransferFlag) {
      this.backgroundImage.updatePixels();
    }
    if (this.__automaticPixelsDataTransferFlag)
      this.differenceImage.updatePixels();
    this.thresholdImage.copy(
      this.differenceImage,
      0,
      0,
      this.currentImage.width,
      this.currentImage.height,
      0,
      0,
      this.differenceImage.width,
      this.differenceImage.height
    );
    this.thresholdImage.filter(this.p.THRESHOLD, this.imageFilterThreshold);
    if (this.__automaticPixelsDataTransferFlag)
      this.thresholdImage.loadPixels();
    return !0;
  }
  public findBlobIndexById(_location: number, _id: number) {
    for (let i = 0; i < this.__blobs[_location].length; i++)
      if (this.__blobs[_location][i].id === _id) return i;
    return -1;
  }
  public findFirstFreeId(_location: number) {
    let temp_result = 0;
    let temp_b = true;
    while (temp_b) {
      temp_b = false;
      for (let i = 0; i < this.__blobs[_location].length; i++) {
        if (this.__blobs[_location][i].id === temp_result) {
          temp_b = true;
          temp_result += 1;
          break;
        }
      }
    }
    return temp_result;
  }
  public trackBlobs() {
    if (this.__blobs[this.__previousBlobsLocation].length < 1) {
      for (var i = 0; i < this.numberOfDetectedBlobs; i++)
        this.__blobs[this.__currentBlobsLocation][i].id = i;
    } else {
      for (
        var i = 0;
        i < this.__blobs[this.__previousBlobsLocation].length;
        i++
      )
        if (this.__blobs[this.__previousBlobsLocation][i].id < 0)
          this.__blobs[this.__previousBlobsLocation][i].id =
            this.findFirstFreeId(this.__previousBlobsLocation);
    }
    var temp_dist, temp_index;
    var temp_distances = [];
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      this.__blobs[this.__currentBlobsLocation][i].id = -1;
      temp_distances[i] = 10.0;
    }
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      for (
        var j = 0;
        j < this.__blobs[this.__previousBlobsLocation].length;
        j++
      ) {
        temp_dist = Math.sqrt(
          Math.pow(
            this.__blobs[this.__previousBlobsLocation][j].normMassCenterX -
              this.__blobs[this.__currentBlobsLocation][i].normMassCenterX,
            2
          ) +
            Math.pow(
              this.__blobs[this.__previousBlobsLocation][j].normMassCenterY -
                this.__blobs[this.__currentBlobsLocation][i].normMassCenterY,
              2
            )
        );
        if (
          temp_dist < temp_distances[i] &&
          temp_dist < this.trackBlobsMaxNormDist
        ) {
          temp_distances[i] = temp_dist;
          this.__blobs[this.__currentBlobsLocation][i].id =
            this.__blobs[this.__previousBlobsLocation][j].id;
        }
      }
    }
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      for (var j = 0; j < this.numberOfDetectedBlobs; j++) {
        if (i === j) continue;
        if (this.__blobs[this.__currentBlobsLocation][i].id < 0) continue;
        if (this.__blobs[this.__currentBlobsLocation][j].id < 0) continue;
        if (
          this.__blobs[this.__currentBlobsLocation][i].id !==
          this.__blobs[this.__currentBlobsLocation][j].id
        )
          continue;
        if (temp_distances[i] > temp_distances[j])
          this.__blobs[this.__currentBlobsLocation][i].id = -1;
        else this.__blobs[this.__currentBlobsLocation][j].id = -1;
      }
    }
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      if (this.__blobs[this.__currentBlobsLocation][i].id >= 0) continue;
      temp_distances[i] = 10.0;
      for (
        var j = 0;
        j < this.__blobs[this.__previousBlobsLocation].length;
        j++
      ) {
        if (
          this.findBlobIndexById(
            this.__currentBlobsLocation,
            this.__blobs[this.__previousBlobsLocation][j].id
          ) >= 0
        )
          continue;
        temp_dist = Math.sqrt(
          Math.pow(
            this.__blobs[this.__previousBlobsLocation][j].normMassCenterX -
              this.__blobs[this.__currentBlobsLocation][i].normMassCenterX,
            2
          ) +
            Math.pow(
              this.__blobs[this.__previousBlobsLocation][j].normMassCenterY -
                this.__blobs[this.__currentBlobsLocation][i].normMassCenterY,
              2
            )
        );
        if (
          temp_dist < temp_distances[i] &&
          temp_dist < this.trackBlobsMaxNormDist
        ) {
          temp_distances[i] = temp_dist;
          this.__blobs[this.__currentBlobsLocation][i].id =
            this.__blobs[this.__previousBlobsLocation][j].id;
        }
      }
    }
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      for (var j = 0; j < this.numberOfDetectedBlobs; j++) {
        if (i === j) continue;
        if (this.__blobs[this.__currentBlobsLocation][i].id < 0) {
          this.__blobs[this.__currentBlobsLocation][i].id =
            this.findFirstFreeId(this.__currentBlobsLocation);
          continue;
        }
        if (this.__blobs[this.__currentBlobsLocation][j].id < 0) {
          this.__blobs[this.__currentBlobsLocation][j].id =
            this.findFirstFreeId(this.__currentBlobsLocation);
          continue;
        }
        if (
          this.__blobs[this.__currentBlobsLocation][i].id !==
          this.__blobs[this.__currentBlobsLocation][j].id
        )
          continue;
        if (temp_distances[i] > temp_distances[j])
          this.__blobs[this.__currentBlobsLocation][i].id =
            this.findFirstFreeId(this.__currentBlobsLocation);
        else
          this.__blobs[this.__currentBlobsLocation][j].id =
            this.findFirstFreeId(this.__currentBlobsLocation);
      }
    }
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      temp_index = this.findBlobIndexById(
        this.__previousBlobsLocation,
        this.__blobs[this.__currentBlobsLocation][i].id
      );
      if (temp_index < 0) continue;
      this.__blobs[this.__currentBlobsLocation][i].creationTime =
        this.__blobs[this.__previousBlobsLocation][temp_index].creationTime;
      this.__blobs[this.__currentBlobsLocation][i].creationFrameCount =
        this.__blobs[this.__previousBlobsLocation][
          temp_index
        ].creationFrameCount;
      this.__blobs[this.__currentBlobsLocation][i].isNewFlag = !1;
    }
  }
  public approximateBlobPolygons() {
    var temp_2PI = Math.PI * 2;
    var temp_radius_1,
      temp_radius_2,
      temp_angle,
      temp_sin_angle,
      temp_cos_angle,
      temp_center_x,
      temp_center_y,
      temp_x,
      temp_y;
    if (this.pointsPerApproximatedBlobPolygon < 3) {
      console.log(
        '[Vida, approximateBlobPolygons] ' +
          'Minumum valid value of pointsPerApproximatedBlobPolygon is 3 ' +
          '(currently: ' +
          this.pointsPerApproximatedBlobPolygon +
          '). The value will be set to 3'
      );
      this.pointsPerApproximatedBlobPolygon = 3;
    } else if (
      Math.floor(this.pointsPerApproximatedBlobPolygon) !==
      Math.ceil(this.pointsPerApproximatedBlobPolygon)
    ) {
      console.log(
        '[Vida, approximateBlobPolygons] ' +
          'The variable pointsPerApproximatedBlobPolygon should be of the ' +
          'integer type, not a float. Current value ' +
          this.pointsPerApproximatedBlobPolygon +
          ' will be changed to' +
          Math.floor(this.pointsPerApproximatedBlobPolygon) +
          '.'
      );
      this.pointsPerApproximatedBlobPolygon = Math.floor(
        this.pointsPerApproximatedBlobPolygon
      );
    }
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      temp_radius_1 = Math.sqrt(
        Math.pow(
          (this.__blobs[this.__currentBlobsLocation][i].normRectX -
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterX) *
            this.thresholdImage.width,
          2
        ) +
          Math.pow(
            (this.__blobs[this.__currentBlobsLocation][i].normRectY -
              this.__blobs[this.__currentBlobsLocation][i].normMassCenterY) *
              this.thresholdImage.height,
            2
          )
      );
      temp_radius_2 = Math.sqrt(
        Math.pow(
          (this.__blobs[this.__currentBlobsLocation][i].normRectX +
            this.__blobs[this.__currentBlobsLocation][i].normRectW -
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterX) *
            this.thresholdImage.width,
          2
        ) +
          Math.pow(
            (this.__blobs[this.__currentBlobsLocation][i].normRectY -
              this.__blobs[this.__currentBlobsLocation][i].normMassCenterY) *
              this.thresholdImage.height,
            2
          )
      );
      if (temp_radius_1 < temp_radius_2) temp_radius_1 = temp_radius_2;
      temp_radius_2 = Math.sqrt(
        Math.pow(
          (this.__blobs[this.__currentBlobsLocation][i].normRectX +
            this.__blobs[this.__currentBlobsLocation][i].normRectW -
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterX) *
            this.thresholdImage.width,
          2
        ) +
          Math.pow(
            (this.__blobs[this.__currentBlobsLocation][i].normRectY +
              this.__blobs[this.__currentBlobsLocation][i].normRectH -
              this.__blobs[this.__currentBlobsLocation][i].normMassCenterY) *
              this.thresholdImage.height,
            2
          )
      );
      if (temp_radius_1 < temp_radius_2) temp_radius_1 = temp_radius_2;
      temp_radius_2 = Math.sqrt(
        Math.pow(
          (this.__blobs[this.__currentBlobsLocation][i].normRectX -
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterX) *
            this.thresholdImage.width,
          2
        ) +
          Math.pow(
            (this.__blobs[this.__currentBlobsLocation][i].normRectY +
              this.__blobs[this.__currentBlobsLocation][i].normRectH -
              this.__blobs[this.__currentBlobsLocation][i].normMassCenterY) *
              this.thresholdImage.height,
            2
          )
      );
      if (temp_radius_1 < temp_radius_2) temp_radius_1 = temp_radius_2;
      temp_radius_1 = Math.floor(temp_radius_1);
      temp_center_x = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterX *
          this.thresholdImage.width
      );
      temp_center_y = Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterY *
          this.thresholdImage.height
      );
      for (var j = 0; j < this.pointsPerApproximatedBlobPolygon; j++) {
        temp_angle = (j / this.pointsPerApproximatedBlobPolygon) * temp_2PI;
        temp_sin_angle = Math.sin(temp_angle);
        temp_cos_angle = Math.cos(temp_angle);
        for (var r = temp_radius_1; r >= 0; r--) {
          temp_x = Math.floor(temp_center_x + r * temp_cos_angle) || 0;
          temp_y = Math.floor(temp_center_y + r * temp_sin_angle) || 0;
          if (temp_x < 0) {
            temp_x = 0;
          } else {
            if (temp_x >= this.thresholdImage.width)
              temp_x = this.thresholdImage.width - 1;
          }
          if (temp_y < 0) {
            temp_y = 0;
          } else {
            if (temp_y >= this.thresholdImage.height)
              temp_y = this.thresholdImage.height - 1;
          }
          if (
            this.__blobMapArray[temp_x][temp_y] ===
            this.__blobs[this.__currentBlobsLocation][i].__rawId
          )
            break;
        }
        if (typeof temp_x !== 'undefined' && typeof temp_y !== 'undefined') {
          this.__blobs[this.__currentBlobsLocation][i].approximatedPolygon[j] = {
            normX: temp_x / this.thresholdImage.width,
            normY: temp_y / this.thresholdImage.height,
          };
        }
      }
    }
  }
  public rejectInnerBlobs() {
    for (var i = this.numberOfDetectedBlobs - 1; i >= 0; i--) {
      for (var j = this.numberOfDetectedBlobs - 1; j >= 0; j--) {
        if (i == j) continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectX <
          this.__blobs[this.__currentBlobsLocation][i].normRectX
        )
          continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectY <
          this.__blobs[this.__currentBlobsLocation][i].normRectY
        )
          continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectX +
            this.__blobs[this.__currentBlobsLocation][j].normRectW <
          this.__blobs[this.__currentBlobsLocation][i].normRectX +
            this.__blobs[this.__currentBlobsLocation][i].normRectW
        )
          continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectY +
            this.__blobs[this.__currentBlobsLocation][j].normRectH <
          this.__blobs[this.__currentBlobsLocation][i].normRectY +
            this.__blobs[this.__currentBlobsLocation][i].normRectH
        )
          continue;
        this.__blobs[this.__currentBlobsLocation].splice(j, 1);
        this.numberOfDetectedBlobs -= 1;
      }
    }
  }
  public rejectOuterBlobs() {
    for (var i = this.numberOfDetectedBlobs - 1; i >= 0; i--) {
      for (var j = this.numberOfDetectedBlobs - 1; j >= 0; j--) {
        if (i == j) continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectX >
          this.__blobs[this.__currentBlobsLocation][i].normRectX
        )
          continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectY >
          this.__blobs[this.__currentBlobsLocation][i].normRectY
        )
          continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectX +
            this.__blobs[this.__currentBlobsLocation][j].normRectW >
          this.__blobs[this.__currentBlobsLocation][i].normRectX +
            this.__blobs[this.__currentBlobsLocation][i].normRectW
        )
          continue;
        if (
          this.__blobs[this.__currentBlobsLocation][j].normRectY +
            this.__blobs[this.__currentBlobsLocation][j].normRectH >
          this.__blobs[this.__currentBlobsLocation][i].normRectY +
            this.__blobs[this.__currentBlobsLocation][i].normRectH
        )
          continue;
        this.__blobs[this.__currentBlobsLocation].splice(j, 1);
        this.numberOfDetectedBlobs -= 1;
      }
    }
  }
  public processBlobs() {
    var temp_raw_blobs_data = [];
    var temp_index = -1;
    var temp_number_of_blobs = 0;
    var temp_area;
    for (var i = 0; i < this.numberOfDetectedBlobs; i++)
      temp_raw_blobs_data[i] = {
        __rawId: i + 1,
        mass: 0,
        normMass: 0.0,
        normMassX: 0.0,
        normMassY: 0.0,
        normMinX: 100000.0,
        normMinY: 100000.0,
        normMaxX: -10.0,
        normMaxY: -10.0,
      };
    for (var y = 0; y < this.thresholdImage.height; y++) {
      for (var x = 0; x < this.thresholdImage.width; x++) {
        temp_index = this.__blobMapArray[x][y] - 1;
        if (temp_index < 0) continue;
        temp_raw_blobs_data[temp_index].normMassX += x;
        temp_raw_blobs_data[temp_index].normMassY += y;
        temp_raw_blobs_data[temp_index].mass += 1;
        if (x < temp_raw_blobs_data[temp_index].normMinX) {
          temp_raw_blobs_data[temp_index].normMinX = x;
        } else {
          if (x > temp_raw_blobs_data[temp_index].normMaxX)
            temp_raw_blobs_data[temp_index].normMaxX = x;
        }
        if (y < temp_raw_blobs_data[temp_index].normMinY) {
          temp_raw_blobs_data[temp_index].normMinY = y;
        } else {
          if (y > temp_raw_blobs_data[temp_index].normMaxY)
            temp_raw_blobs_data[temp_index].normMaxY = y;
        }
      }
    }
    this.__blobs[this.__currentBlobsLocation].splice(
      0,
      this.__blobs[this.__currentBlobsLocation].length
    );
    for (var i = 0; i < this.numberOfDetectedBlobs; i++) {
      temp_raw_blobs_data[i].normMass =
        temp_raw_blobs_data[i].mass /
        (this.thresholdImage.height * this.thresholdImage.width);
      temp_area =
        ((temp_raw_blobs_data[i].normMaxX - temp_raw_blobs_data[i].normMinX) *
          (temp_raw_blobs_data[i].normMaxY - temp_raw_blobs_data[i].normMinY)) /
        (this.backgroundImage.width * this.backgroundImage.height);
      if (
        temp_raw_blobs_data[i].normMass < this.normMinBlobMass ||
        temp_raw_blobs_data[i].normMass > this.normMaxBlobMass ||
        temp_area < this.normMinBlobArea ||
        temp_area > this.normMaxBlobArea
      )
        continue;
      temp_raw_blobs_data[i].normMassX /= temp_raw_blobs_data[i].mass;
      temp_raw_blobs_data[i].normMassY /= temp_raw_blobs_data[i].mass;
      temp_raw_blobs_data[i].normMassX /= this.backgroundImage.width;
      temp_raw_blobs_data[i].normMassY /= this.backgroundImage.height;
      temp_raw_blobs_data[i].normMinX /= this.thresholdImage.width;
      temp_raw_blobs_data[i].normMinY /= this.thresholdImage.height;
      temp_raw_blobs_data[i].normMaxX /= this.thresholdImage.width;
      temp_raw_blobs_data[i].normMaxY /= this.thresholdImage.height;
      this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs] =
        new VidaBlob();
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].normMassCenterX = temp_raw_blobs_data[i].normMassX;
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].normMassCenterY = temp_raw_blobs_data[i].normMassY;
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].normRectX = temp_raw_blobs_data[i].normMinX;
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].normRectY = temp_raw_blobs_data[i].normMinY;
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].normRectW =
        temp_raw_blobs_data[i].normMaxX - temp_raw_blobs_data[i].normMinX;
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].normRectH =
        temp_raw_blobs_data[i].normMaxY - temp_raw_blobs_data[i].normMinY;
      this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].normMass =
        temp_raw_blobs_data[i].normMass;
      this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].__rawId =
        temp_raw_blobs_data[i].__rawId;
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].creationTime = this.p.millis();
      this.__blobs[this.__currentBlobsLocation][
        temp_number_of_blobs
      ].creationFrameCount = this.p.frameCount;
      temp_number_of_blobs += 1;
    }
    this.numberOfDetectedBlobs = temp_number_of_blobs;
  }
  public updateBlobs() {
    this.__currentBlobsLocation = (this.__currentBlobsLocation + 1) % 2;
    this.__previousBlobsLocation = (this.__currentBlobsLocation + 1) % 2;
    this.numberOfDetectedBlobs = this.findBlobs();
    this.processBlobs();
    switch (this.rejectBlobsMethod) {
      case this.REJECT_NONE_BLOBS:
        break;
      case this.REJECT_INNER_BLOBS:
        this.rejectInnerBlobs();
        break;
      case this.REJECT_OUTER_BLOBS:
        this.rejectOuterBlobs();
        break;
      default:
        console.log(
          '[Vida, updateBlobs] unhandled rejectBlobsMethod value: ' +
            this.rejectBlobsMethod
        );
    }
    if (this.trackBlobsFlag) {
      this.trackBlobs();
    } else {
      for (var i = 0; i < this.numberOfDetectedBlobs; i++)
        this.__blobs[this.__currentBlobsLocation][i].id = i;
    }
    if (this.approximateBlobPolygonsFlag) this.approximateBlobPolygons();
  }
  public findBlobs() {
    this.findBlobs_createTemporaryIndices();
    var temp_previousNumberOfIdentifiers = -1;
    var temp_currentNumberOfIdentifiers = 0;
    while (
      temp_previousNumberOfIdentifiers !== temp_currentNumberOfIdentifiers
    ) {
      this.findBlobs_mergerIterationA();
      this.findBlobs_mergerIterationB();
      temp_previousNumberOfIdentifiers = temp_currentNumberOfIdentifiers;
      temp_currentNumberOfIdentifiers =
        this.findBlobs_countUnorderedIdentifiers();
    }
    return this.findBlobs_optimizeIdentifiers();
  }
  public findBlobs_createTemporaryIndices() {
    var temp_pixel_position;
    var temp_blob_identifier = 1;
    var temp_wmax = this.thresholdImage.width - 1;
    var temp_hmax = this.thresholdImage.height - 1;
    this.resetBlobMapArray();
    for (var temp_y = 1; temp_y < temp_hmax; temp_y++) {
      for (var temp_x = 1; temp_x < temp_wmax; temp_x++) {
        temp_pixel_position = (temp_y * this.thresholdImage.width + temp_x) * 4;
        if (this.thresholdImage.pixels[temp_pixel_position] > 0)
          this.__blobMapArray[temp_x][temp_y] = temp_blob_identifier;
        else temp_blob_identifier += 1;
      }
    }
  }
  public findBlobs_mergerIterationA() {
    var temp_nn, temp_ne, temp_ee, temp_se, temp_ss, temp_sw, temp_ww, temp_nw;
    var temp_wmax = this.thresholdImage.width - 1;
    var temp_hmax = this.thresholdImage.height - 1;
    var temp_lowest_index;
    for (var temp_y = 1; temp_y < temp_hmax; temp_y++) {
      for (var temp_x = 1; temp_x < temp_wmax; temp_x++) {
        if (this.__blobMapArray[temp_x][temp_y] === 0) continue;
        temp_nn = this.__blobMapArray[temp_x][temp_y - 1];
        temp_ne = this.__blobMapArray[temp_x + 1][temp_y - 1];
        temp_ee = this.__blobMapArray[temp_x + 1][temp_y];
        temp_se = this.__blobMapArray[temp_x + 1][temp_y + 1];
        temp_ss = this.__blobMapArray[temp_x][temp_y + 1];
        temp_sw = this.__blobMapArray[temp_x - 1][temp_y + 1];
        temp_ww = this.__blobMapArray[temp_x - 1][temp_y];
        temp_nw = this.__blobMapArray[temp_x - 1][temp_y - 1];
        temp_lowest_index = this.__blobMapArray[temp_x][temp_y];
        if (temp_nn > 0 && temp_nn < temp_lowest_index)
          temp_lowest_index = temp_nn;
        if (temp_ne > 0 && temp_ne < temp_lowest_index)
          temp_lowest_index = temp_ne;
        if (temp_ee > 0 && temp_ee < temp_lowest_index)
          temp_lowest_index = temp_ee;
        if (temp_se > 0 && temp_se < temp_lowest_index)
          temp_lowest_index = temp_se;
        if (temp_ss > 0 && temp_ss < temp_lowest_index)
          temp_lowest_index = temp_ss;
        if (temp_sw > 0 && temp_sw < temp_lowest_index)
          temp_lowest_index = temp_sw;
        if (temp_ww > 0 && temp_ww < temp_lowest_index)
          temp_lowest_index = temp_ww;
        if (temp_nw > 0 && temp_nw < temp_lowest_index)
          temp_lowest_index = temp_nw;
        this.__blobMapArray[temp_x][temp_y] = temp_lowest_index;
        if (this.__blobMapArray[temp_x][temp_y - 1] > 0)
          this.__blobMapArray[temp_x][temp_y - 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x + 1][temp_y - 1] > 0)
          this.__blobMapArray[temp_x + 1][temp_y - 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x + 1][temp_y] > 0)
          this.__blobMapArray[temp_x + 1][temp_y] = temp_lowest_index;
        if (this.__blobMapArray[temp_x + 1][temp_y + 1] > 0)
          this.__blobMapArray[temp_x + 1][temp_y + 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x][temp_y + 1] > 0)
          this.__blobMapArray[temp_x][temp_y + 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x - 1][temp_y + 1] > 0)
          this.__blobMapArray[temp_x - 1][temp_y + 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x - 1][temp_y] > 0)
          this.__blobMapArray[temp_x - 1][temp_y] = temp_lowest_index;
        if (this.__blobMapArray[temp_x - 1][temp_y - 1] > 0)
          this.__blobMapArray[temp_x - 1][temp_y - 1] = temp_lowest_index;
      }
    }
  }
  public findBlobs_mergerIterationB() {
    var temp_nn, temp_ne, temp_ee, temp_se, temp_ss, temp_sw, temp_ww, temp_nw;
    var temp_wmax = this.thresholdImage.width - 2;
    var temp_hmax = this.thresholdImage.height - 2;
    var temp_lowest_index;
    for (var temp_x = temp_wmax; temp_x > 0; temp_x--) {
      for (var temp_y = temp_hmax; temp_y > 0; temp_y--) {
        if (this.__blobMapArray[temp_x][temp_y] === 0) continue;
        temp_nn = this.__blobMapArray[temp_x][temp_y - 1];
        temp_ne = this.__blobMapArray[temp_x + 1][temp_y - 1];
        temp_ee = this.__blobMapArray[temp_x + 1][temp_y];
        temp_se = this.__blobMapArray[temp_x + 1][temp_y + 1];
        temp_ss = this.__blobMapArray[temp_x][temp_y + 1];
        temp_sw = this.__blobMapArray[temp_x - 1][temp_y + 1];
        temp_ww = this.__blobMapArray[temp_x - 1][temp_y];
        temp_nw = this.__blobMapArray[temp_x - 1][temp_y - 1];
        temp_lowest_index = this.__blobMapArray[temp_x][temp_y];
        if (temp_nn > 0 && temp_nn < temp_lowest_index)
          temp_lowest_index = temp_nn;
        if (temp_ne > 0 && temp_ne < temp_lowest_index)
          temp_lowest_index = temp_ne;
        if (temp_ee > 0 && temp_ee < temp_lowest_index)
          temp_lowest_index = temp_ee;
        if (temp_se > 0 && temp_se < temp_lowest_index)
          temp_lowest_index = temp_se;
        if (temp_ss > 0 && temp_ss < temp_lowest_index)
          temp_lowest_index = temp_ss;
        if (temp_sw > 0 && temp_sw < temp_lowest_index)
          temp_lowest_index = temp_sw;
        if (temp_ww > 0 && temp_ww < temp_lowest_index)
          temp_lowest_index = temp_ww;
        if (temp_nw > 0 && temp_nw < temp_lowest_index)
          temp_lowest_index = temp_nw;
        this.__blobMapArray[temp_x][temp_y] = temp_lowest_index;
        if (this.__blobMapArray[temp_x][temp_y - 1] > 0)
          this.__blobMapArray[temp_x][temp_y - 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x + 1][temp_y - 1] > 0)
          this.__blobMapArray[temp_x + 1][temp_y - 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x + 1][temp_y] > 0)
          this.__blobMapArray[temp_x + 1][temp_y] = temp_lowest_index;
        if (this.__blobMapArray[temp_x + 1][temp_y + 1] > 0)
          this.__blobMapArray[temp_x + 1][temp_y + 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x][temp_y + 1] > 0)
          this.__blobMapArray[temp_x][temp_y + 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x - 1][temp_y + 1] > 0)
          this.__blobMapArray[temp_x - 1][temp_y + 1] = temp_lowest_index;
        if (this.__blobMapArray[temp_x - 1][temp_y] > 0)
          this.__blobMapArray[temp_x - 1][temp_y] = temp_lowest_index;
        if (this.__blobMapArray[temp_x - 1][temp_y - 1] > 0)
          this.__blobMapArray[temp_x - 1][temp_y - 1] = temp_lowest_index;
      }
    }
  }
  public findBlobs_optimizeIdentifiers() {
    var temp_wmax = this.thresholdImage.width - 1;
    var temp_hmax = this.thresholdImage.height - 1;
    var temp_redirections_array = [];
    var temp_b;
    for (var temp_y = 1; temp_y < temp_hmax; temp_y++) {
      for (var temp_x = 1; temp_x < temp_wmax; temp_x++) {
        if (this.__blobMapArray[temp_x][temp_y] === 0) continue;
        temp_b = !0;
        for (var i = 0; i < temp_redirections_array.length; i++) {
          if (
            temp_redirections_array[i] === this.__blobMapArray[temp_x][temp_y]
          ) {
            this.__blobMapArray[temp_x][temp_y] = i + 1;
            temp_b = !1;
            break;
          }
        }
        if (temp_b) {
          temp_redirections_array[temp_redirections_array.length] =
            this.__blobMapArray[temp_x][temp_y];
          this.__blobMapArray[temp_x][temp_y] = temp_redirections_array.length;
        }
      }
    }
    return temp_redirections_array.length;
  }
  public findBlobs_countUnorderedIdentifiers() {
    var temp_wmax = this.thresholdImage.width - 1;
    var temp_hmax = this.thresholdImage.height - 1;
    var temp_identifiers_array = [];
    var temp_b;
    for (var temp_y = 1; temp_y < temp_hmax; temp_y++) {
      for (var temp_x = 1; temp_x < temp_wmax; temp_x++) {
        if (this.__blobMapArray[temp_x][temp_y] === 0) continue;
        temp_b = !0;
        for (var i = 0; i < temp_identifiers_array.length; i++) {
          if (
            temp_identifiers_array[i] === this.__blobMapArray[temp_x][temp_y]
          ) {
            temp_b = !1;
            break;
          }
        }
        if (temp_b) {
          temp_identifiers_array[temp_identifiers_array.length] =
            this.__blobMapArray[temp_x][temp_y];
        }
      }
    }
    return temp_identifiers_array.length;
  }
}

export default Vida;