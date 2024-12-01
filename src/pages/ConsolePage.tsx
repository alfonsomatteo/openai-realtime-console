/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';

import './ConsolePage.scss';

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function ConsolePage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
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
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({ apiKey: apiKey, dangerouslyAllowAPIKeyInBrowser: true })
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();
    client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }]);
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  }, []);

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

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

      {/* Hide the content, except for the navbar */}
      <div style={{ display: 'none' }}>
        <div className="content-main">
          <div className="content-logs">
            <div className="content-block events">
              <div className="visualization">
                <div className="visualization-entry client">
                  <canvas ref={clientCanvasRef} />
                </div>
                <div className="visualization-entry server">
                  <canvas ref={serverCanvasRef} />
                </div>
              </div>
              <div className="content-block-title">events</div>
              <div className="content-block-body" ref={eventsScrollRef}>
                {!realtimeEvents.length && `awaiting connection...`}
                {realtimeEvents.map((realtimeEvent, i) => {
                  const count = realtimeEvent.count;
                  const event = { ...realtimeEvent.event };
                  if (event.type === 'input_audio_buffer.append') {
                    event.audio = `[trimmed: ${event.audio.length} bytes]`;
                  } else if (event.type === 'response.audio.delta') {
                    event.delta = `[trimmed: ${event.delta.length} bytes]`;
                  }
                  return (
                    <div className="event" key={event.event_id}>
                      <div className="event-timestamp">
                        {formatTime(realtimeEvent.time)}
                      </div>
                      <div className="event-details">
                        <div
                          className="event-summary"
                          onClick={() => {
                            // toggle event details
                            const id = event.event_id;
                            const expanded = { ...expandedEvents };
                            if (expanded[id]) {
                              delete expanded[id];
                            } else {
                              expanded[id] = true;
                            }
                            setExpandedEvents(expanded);
                          }}
                        >
                          <div
                            className={`event-source ${
                              event.type === 'error'
                                ? 'error'
                                : realtimeEvent.source
                            }`}
                          >
                            {realtimeEvent.source === 'client' ? (
                              <ArrowUp />
                            ) : (
                              <ArrowDown />
                            )}
                            <span>
                              {event.type === 'error'
                                ? 'error!'
                                : realtimeEvent.source}
                            </span>
                          </div>
                          <div className="event-type">
                            {event.type}
                            {count && ` (${count})`}
                          </div>
                        </div>
                        {!!expandedEvents[event.event_id] && (
                          <div className="event-payload">
                            {JSON.stringify(event, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="content-block conversation">
              <div className="content-block-title">conversation</div>
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
                        <div
                          className="close"
                          onClick={() =>
                            deleteConversationItem(conversationItem.id)
                          }
                        >
                          <X />
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
                                conversationItem.formatted.text ||
                                '(item sent)'}
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
    </div>
  );
}

