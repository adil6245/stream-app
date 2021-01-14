import { io, Socket } from 'socket.io-client';
import { environment } from './../environments/environment';
import * as mediasoupClient from 'mediasoup-client';

export class SocketioService {
  socket: Socket;
  device;
  producer;
  constructor() {}

  setupSocketConnection() {
    this.socket = io(environment.SOCKET_ENDPOINT);
  }

  /**
   * emits socket event to get mediasoup supported RTP capabilities
   * @param video 
   * @param video2 
   */
  initializeMediaSoup(video, video2) {
    this.socket.emit('getRouterRtpCapabilities', null, async (data) => {
      await this.loadDevice(data);
      this.publish(video);
      this.subscribe(video2);
    });
  }

  /**
   * Loads the device with the RTP capabilities of the mediasoup router
   * @param routerRtpCapabilities 
   */
  async loadDevice(routerRtpCapabilities) {
    try {
      this.device = new mediasoupClient.Device();
    } catch (error) {
      if (error.name === 'UnsupportedError') {
        console.error('browser not supported');
      }
    }
    await this.device.load({ routerRtpCapabilities });
  }

  /**
   * Creates a new WebRTC transport to send media
   * @param video 
   */
  async publish(video) {
    this.socket.emit(
      'createProducerTransport',
      {
        forceTcp: false,
        rtpCapabilities: this.device.rtpCapabilities,
      },
      async (data) => {
        if (data.error) {
          console.error(data.error);
          return;
        }
        const transport = this.device.createSendTransport(data);
        transport.on(
          'connect',
          async ({ dtlsParameters }, callback, errback) => {
            this.socket.emit(
              'connectProducerTransport',
              { dtlsParameters },
              async (data) => callback
            );
          }
        );

        transport.on(
          'produce',
          async ({ kind, rtpParameters }, callback, errback) => {
            try {
              this.socket.emit(
                'produce',
                {
                  transportId: transport.id,
                  kind,
                  rtpParameters,
                },
                async ({ id }) => {
                  callback({ id });
                }
              );
            } catch (err) {
              errback(err);
            }
          }
        );

        transport.on('connectionstatechange', (state) => {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              video.nativeElement.srcObject = stream;
              break;

            case 'failed':
              transport.close();
              break;

            default:
              break;
          }
        });

        let stream;
        try {
          stream = await this.getUserMedia(transport);
          const track = stream.getVideoTracks()[0];
          const params = { track };
          this.producer = await transport.produce(params);
        } catch (err) {}
      }
    );
  }

  /**
   * asks for user video and audio
   * @param transport 
   */
  async getUserMedia(transport) {
    if (!this.device.canProduce('video')) {
      console.error('cannot produce video');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      console.error('getUserMedia() failed:', err.message);
      throw err;
    }
    return stream;
  }

  async subscribe(video) {
    this.socket.emit(
      'createConsumerTransport',
      {
        forceTcp: false,
      },
      async (data) => {
        if (data.error) {
          console.error(data.error);
          return;
        }

        const transport = this.device.createRecvTransport(data);
        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
          this.socket.emit(
            'connectConsumerTransport',
            {
              transportId: transport.id,
              dtlsParameters,
            },
            async (data) => callback
          );
        });

        transport.on('connectionstatechange', async (state) => {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              video.nativeElement.srcObject = await stream;
              await this.socket.emit('resume');
              break;

            case 'failed':
              transport.close();
              break;

            default:
              break;
          }
        });

        const stream = this.consume(transport);
      }
    );
  }

  /**
   * Instructs the transport to receive an audio or video track to the mediasoup router
   * @param transport 
   */
  async consume(transport) {
    const { rtpCapabilities } = this.device;
    this.socket.emit('consume', { rtpCapabilities }, async (data) => {
      const { producerId, id, kind, rtpParameters } = data;

      const codecOptions = {};
      const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
      });
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      return stream;
    });
  }

  on(event, listener) {
    this.socket.on(event, listener);
  }
}
