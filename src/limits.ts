export class TokenLimits {
  maxTokens: number
  maxCompletionTokens: number
  requestTokens: number
  responseTokens: number
  knowledgeCutOff: string

  constructor(model = 'o4-mini') {
    this.knowledgeCutOff = '2021-09-01'
    this.maxTokens = 0
    this.maxCompletionTokens = 0

    switch (model) {
      case 'o4-mini':
        this.maxCompletionTokens = 100000
        this.responseTokens = 75000
        this.knowledgeCutOff = '2025-04-16'
        break
      case 'o3-mini':
        this.maxCompletionTokens = 100000
        this.responseTokens = 75000
        this.knowledgeCutOff = '2025-01-31'
        break
      case 'gpt-4o':
        this.maxTokens = 128000
        this.responseTokens = 4000
        this.knowledgeCutOff = '2024-11-20'
        break
      case 'gpt-4o-2024-05-13':
        this.maxTokens = 128000
        this.responseTokens = 4000
        this.knowledgeCutOff = '2023-10-01'
        break
      case 'gpt-4-turbo':
        this.maxTokens = 128000
        this.responseTokens = 4000
        this.knowledgeCutOff = '2023-04-01'
        break
      case 'gpt-4-turbo-2024-04-09':
        this.maxTokens = 128000
        this.responseTokens = 4000
        this.knowledgeCutOff = '2023-04-01'
        break
      case 'gpt-4':
        this.maxTokens = 8000
        this.responseTokens = 2000
        break
      case 'gpt-4-32k':
        this.maxTokens = 32600
        this.responseTokens = 4000
        break
      case 'gpt-3.5-turbo-16k':
        this.maxTokens = 16300
        this.responseTokens = 3000
        break
      default:
        this.maxTokens = 4000
        this.responseTokens = 1000
        break
    }

    if (model === 'o3-mini' || model === 'o4-mini') {
      this.requestTokens = 100000
    } else {
      this.requestTokens = this.maxTokens - this.responseTokens - 100
    }
  }

  string(): string {
    if (this.maxCompletionTokens > 0) {
      return `max_completion_tokens=${this.maxCompletionTokens}, request_tokens=${this.requestTokens}, response_tokens=${this.responseTokens}`
    } else {
      return `max_tokens=${this.maxTokens}, request_tokens=${this.requestTokens}, response_tokens=${this.responseTokens}`
    }
  }
}
