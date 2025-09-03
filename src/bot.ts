import './fetch-polyfill'

import {info, setFailed, warning} from '@actions/core'
import OpenAI from 'openai'
import pRetry from 'p-retry'
import {OpenAIOptions, Options} from './options'

// define type to save parentMessageId and conversationId
export interface Ids {
  parentMessageId?: string
  conversationId?: string
}

export class Bot {
  private readonly client: OpenAI | null = null
  private readonly options: Options
  private readonly openaiOptions: OpenAIOptions

  constructor(options: Options, openaiOptions: OpenAIOptions) {
    this.options = options
    this.openaiOptions = openaiOptions

    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_API_ORG ?? undefined,
        baseURL: options.apiBaseUrl,
        dangerouslyAllowBrowser: true // for GitHub Actions environment
      })
    } else {
      const err =
        "Unable to initialize the OpenAI API, 'OPENAI_API_KEY' environment variable is not available"
      throw new Error(err)
    }
  }

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let res: [string, Ids] = ['', {}]
    try {
      res = await this.chat_(message, ids)
      return res
    } catch (e: unknown) {
      warning(`Failed to chat: ${e}, backtrace: ${(e as Error).stack}`)
      return res
    }
  }

  private readonly chat_ = async (
    message: string,
    ids: Ids
  ): Promise<[string, Ids]> => {
    // record timing
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }

    if (this.client == null) {
      setFailed('The OpenAI API is not initialized')
      return ['', {}]
    }

    let responseText = ''
    let responseId = ''

    try {
      // Build the list of messages for the conversation
      const currentDate = new Date().toISOString().split('T')[0]
      const systemMessage = `${this.options.systemMessage} 
Knowledge cutoff: ${this.openaiOptions.tokenLimits.knowledgeCutOff}
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${this.options.language}
`

      // Define messages array with proper type
      const messages: Array<OpenAI.ChatCompletionMessageParam> = [
        {
          role: 'system',
          content: systemMessage
        }
      ]

      // If we have a previous conversation, add it to maintain context
      if (ids.parentMessageId && ids.conversationId) {
        // We don't have actual previous messages, so we use the IDs to reference them
        // In a real implementation, you'd want to store and retrieve the full message history
        info(`Continuing conversation with parent ID: ${ids.parentMessageId}`)
      }

      // Add the current user message
      messages.push({
        role: 'user',
        content: message
      })

      const response = await pRetry(
        async () => {
          const completionParams: OpenAI.ChatCompletionCreateParams = {
            model: this.openaiOptions.model,
            messages: messages,
            store: true // Store the conversation
          }

          // Handle differences between models
          if (
            this.openaiOptions.model === 'o3-mini' ||
            this.openaiOptions.model === 'o4-mini'
          ) {
            // o3-mini specific parameters
            // Calculate max_completion_tokens to avoid exceeding the model's context limit
            // Reserve enough tokens for the input messages (typically ~1500 tokens)
            const reservedInputTokens = 2000; // Buffer to account for system message and user input
            const adjustedMaxCompletionTokens = 200000 - reservedInputTokens;

            completionParams.max_completion_tokens = Math.min(
              adjustedMaxCompletionTokens,
              this.openaiOptions.tokenLimits.maxCompletionTokens || 100000
            );

            info(`Using max_completion_tokens: ${completionParams.max_completion_tokens}`);
            completionParams.reasoning_effort = "medium";
          } else {
            // Standard models parameters
            completionParams.max_tokens = this.openaiOptions.tokenLimits.responseTokens
            completionParams.temperature = this.options.openaiModelTemperature
          }

          return await this.client!.chat.completions.create(completionParams)
        },
        {
          retries: this.options.openaiRetries,
          onFailedAttempt: error => {
            warning(
              `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`
            )
            info(`Error: ${error.message}`)
          }
        }
      )

      const end = Date.now()
      if (this.options.debug) {
        info(`response: ${JSON.stringify(response)}`)
      }
      info(
        `openai chat completion (including retries) response time: ${
          end - start
        } ms`
      )

      if (response && response.choices && response.choices.length > 0) {
        responseText = response.choices[0].message.content || ''
        responseId = response.id
      } else {
        warning('openai response has no choices')
      }
    } catch (e: unknown) {
      info(`Failed to send message to openai: ${e}, backtrace: ${(e as Error).stack}`)
      throw e
    }

    // remove the prefix "with " in the response if it exists
    if (responseText.startsWith('with ')) {
      responseText = responseText.substring(5)
    }

    if (this.options.debug) {
      info(`openai responses: ${responseText}`)
    }

    const newIds: Ids = {
      parentMessageId: responseId,
      conversationId: responseId // OpenAI API v2 doesn't have a specific conversationId
    }

    return [responseText, newIds]
  }
}
