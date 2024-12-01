import { useEffect, useRef, useState, useCallback } from 'react';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { RealtimeClient } from '@openai/realtime-api-beta';

import './ConsolePage.scss';

export function ConsolePage() {
  // Retrieve the API key from the environment variables
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Missing OpenAI API Key. Please set REACT_APP_OPENAI_API_KEY.');
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
  const clientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: apiKey, dangerouslyAllowAPIKeyInBrowser: true }));

  // Manage the recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  /**
   * Start the recording process
   */
  const startRecording = async () => {
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Check if the recording has not started yet, then begin recording
    if (!wavRecorder.recording) {
      await wavRecorder.begin();
    }

    setIsRecording(true);
    await wavStreamPlayer.connect();

    // Handle track sample offset and interrupt if needed
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await clientRef.current.cancelResponse(trackId, offset);
    }

    // Start recording audio from the microphone
    await wavRecorder.record((data) => clientRef.current.appendInputAudio(data.mono));
  };

  /**
   * Stop the recording process
   */
  const stopRecording = async () => {
    const wavRecorder = wavRecorderRef.current;

    // Ensure that we pause the recording if it is already in progress
    if (wavRecorder.recording) {
      await wavRecorder.pause(); // Pause the recording first
    }

    setIsRecording(false);
    clientRef.current.createResponse();
  };

  /**
   * Connect to conversation and handle incoming messages
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    setIsConnected(true);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }]);
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));

  }, []);

  /**
   * Utility to handle connection and other side effects
   */
  useEffect(() => {
    if (!isConnected) {
      console.log('Connecting to Realtime API automatically...');
      connectConversation()
        .then(() => console.log('Connected successfully.'))
        .catch((error) => {
          console.error('Failed to auto-connect:', error);
        });
    }
  }, [isConnected, connectConversation]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/logo_cartesian_web.svg" />
          <span>realtime console</span>
        </div>
      </div>

      <div className="content-main">
        <div className="content-actions">
          {/* Buttons for controlling recording */}
          <button onClick={startRecording} disabled={isRecording}>
            Start Recording
          </button>
          <button onClick={stopRecording} disabled={!isRecording}>
            Stop Recording
          </button>
        </div>

        <div className="content-logs">
          {/* Event logs and conversation */}
          <div className="content-block conversation">
            <div className="content-block-title">Conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

