import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { SocketioService } from './socketio.service';
import * as mediasoupClient from "mediasoup-client";
import { Producer, RtpParameters } from "mediasoup-client/lib/types";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('video')
  public video: ElementRef;
  @ViewChild('video2')
  public video2: ElementRef;
  @ViewChild('canvas')
  public canvas: ElementRef;

  producer: Producer;
  rtpParameters: RtpParameters;
  device = new mediasoupClient.Device();


  constructor(private socketService: SocketioService) {}

  ngOnInit() {
    this.socketService.setupSocketConnection();
  }

  ngAfterViewInit() {
    // this.initCamera();
    this.socketService.initializeMediaSoup(this.video, this.video2);
  }


  /**
   * Ask for camera and mic permissions
   */
  initCamera() {
    const config = { video: true, audio: true };
    const browser = <any>navigator;

    browser.getUserMedia =
      browser.getUserMedia ||
      // for chrome
      browser.webkitGetUserMedia ||
      // for firefox
      browser.mozGetUserMedia ||
      // for internet explorer
      browser.msGetUserMedia;

    browser.mediaDevices.getUserMedia(config).then((stream) => {
      this.video.nativeElement.srcObject = stream;
      // this.initializePlayers();
    });
  }

  /**
   * Initialize all players and draw them on canvas
   */
  initializePlayers() {
    this.focusAllPlayers();
    this.drawPlayerOnCanvas('video', 0, 0, 512, 480);
    this.drawPlayerOnCanvas('video2', 512, 0, 512, 480);
  }

  /**
   * Triggered when a video player is clicked
   * Draws the clicked video player on canvas
   * @param playerName
   */
  focusVideo(playerName) {
    this.unFocusAllPlayers();
    this[playerName].nativeElement.focused = true;
    this.clearCanvas();
    this.drawPlayerOnCanvas(playerName);
  }

  /**
   * Clear the canvas for new drawing
   */
  clearCanvas() {
    this.canvas.nativeElement
      .getContext('2d')
      .clearRect(
        0,
        0,
        this.canvas.nativeElement.width,
        this.canvas.nativeElement.height
      );
  }

  /**
   * Draw given video player on canvas
   */
  drawPlayerOnCanvas(
    playerName: string,
    x = 0,
    y = 0,
    width = 1024,
    height = 480
  ) {
    const __this = this;
    (function loop() {
      if (__this[playerName].nativeElement.focused) {
        __this.canvas.nativeElement
          .getContext('2d')
          .drawImage(__this[playerName].nativeElement, x, y, width, height);
        setTimeout(loop, 1000 / 30);
      }
    })();
  }

  /**
   * Set all video player focus flag to true
   */
  focusAllPlayers() {
    this.video.nativeElement.focused = true;
    this.video2.nativeElement.focused = true;
  }

  /**
   * Set all video player focus flag to false
   */
  unFocusAllPlayers() {
    this.video.nativeElement.focused = false;
    this.video2.nativeElement.focused = false;
  }
}
