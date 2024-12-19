import EventEmitter from 'events';

export enum LiveTranscriptionEvents {
  Open = 'open',
  Close = 'close',
  Error = 'error',
  Transcript = 'transcript',
  Metadata = 'metadata',
  Warning = 'warning'
}

export enum LiveConnectionState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export class CustomLiveClient extends EventEmitter {
  public _socket: WebSocket;

  constructor(socket: WebSocket) {
    super();
    
    this._socket = socket;

    // Set up WebSocket event handlers for connection lifecycle events
    this._socket.onopen = () => {
      console.log("WebSocket connection opened");
      this.emit(LiveTranscriptionEvents.Open);
    };

    this._socket.onclose = (event) => {
      console.log("WebSocket connection closed");
      this.emit(LiveTranscriptionEvents.Close, event);
    };

    this._socket.onerror = (event) => {
      console.log("WebSocket error occurred", event);
      this.emit(LiveTranscriptionEvents.Error, event);
    };

    // Handle incoming messages and parse JSON data
    this._socket.onmessage = (event) => {
      console.log("Received WebSocket message:");
      try {
        const data = JSON.parse(event.data.toString());
        this.emit(LiveTranscriptionEvents.Transcript, data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        this.emit(LiveTranscriptionEvents.Error, {
          event,
          message: 'Unable to parse data as JSON.',
          error,
        });
      }
    };
  }

  /**
   * Sends data through the WebSocket if the connection is open
   * @param data - Data to send through the WebSocket
   */
  public send(data: string | ArrayBufferLike | Blob): void {
    if (this._socket.readyState === LiveConnectionState.OPEN) {
      console.log("Sending data to WebSocket, size:", data instanceof Uint8Array ? data.length : 'unknown');
      this._socket.send(data);
    } else {
      console.error("Cannot send data - WebSocket not open. Current state:", this._socket.readyState);
      throw new Error('Could not send. Connection not open.');
    }
  }

  /**
   * Closes the WebSocket connection gracefully
   */
  public finish(): void {
    console.log("Closing WebSocket connection");
    this._socket.send(JSON.stringify({ type: 'CloseStream' }));
    this._socket.close();
  }
}

export default CustomLiveClient;