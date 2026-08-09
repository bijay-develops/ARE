import React from 'react';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import type { CacheManager } from '../../cache/cache-manager.js';
import type {
  PageModule,
  RenderMeta,
  RenderResult,
  RenderStrategy,
  RequestContext,
} from '../../core/types.js';
import { toPublicContext } from '../../core/types.js';
import { clientBootScript } from '../../utils/helpers.js';
import { StreamDocument } from './suspense-handler.js';

/**
 * Streaming SSR: flush the shell as soon as it is ready and stream Suspense
 * boundaries as they resolve. Returns a Readable (PassThrough) the server pipes
 * directly to the HTTP response — never buffered.
 */
export class StreamingSSRStrategy implements RenderStrategy {
  readonly name = 'STREAMING_SSR' as const;

  async render(
    ctx: RequestContext,
    page: PageModule,
    _cache: CacheManager,
    meta?: RenderMeta,
  ): Promise<RenderResult> {
    const data = page.getData ? await page.getData(ctx) : {};
    const context = toPublicContext(ctx);
    const reason = meta?.reason;
    const element = React.createElement(
      StreamDocument,
      { title: page.title, strategy: this.name, reason },
      React.createElement(page.Component, { data, strategy: this.name, reason, context }),
    );

    const passthrough = new PassThrough();

    await new Promise<void>((resolve, reject) => {
      const { pipe } = renderToPipeableStream(element, {
        bootstrapScriptContent: clientBootScript(page.route, this.name, data, { reason, context }),
        bootstrapScripts: ['/client.js'],
        onShellReady() {
          // Shell is ready: begin streaming to the client (good TTFB).
          passthrough.write('<!doctype html>');
          pipe(passthrough);
          resolve();
        },
        onShellError(err) {
          reject(err);
        },
      });
    });

    return {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'transfer-encoding': 'chunked',
        'x-streaming': 'true',
      },
      body: passthrough,
      fromCache: false,
    };
  }
}
