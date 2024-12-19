import { useState } from 'react';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class ConversationManager {
  private baseUrl: string = "https://api.groq.com/v1/chat/completions";
  private model: string = "mixtral-8x7b-32768";
  private messages: Message[] = [];

  constructor() {
    // Initialize with system prompt and welcome message
    this.messages = [
      {
        role: 'system',
        content: `You are an AI assistant. Keep replies under 25 letters.`
      },
      {
        role: 'assistant',
        content: 'Hi! Need help?'
      }
    ];
  }
  async sendMessage(userMessage: string): Promise<string> {
    try {
      // Add user message to conversation history
      this.messages.push({
        role: 'user',
        content: userMessage
      });

      // Prepare the request to Groq API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer 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`
        },
        body: JSON.stringify({
          messages: this.messages,
          model: 'llama3-8b-8192',
          temperature: 1,
          top_p: 1,
          stream: false,
          stop: null,
          max_tokens: 25 // Limit response length
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantResponse = data.choices[0].message.content;

        // Add assistant response to conversation history
        this.messages.push({
          role: 'assistant',
          content: assistantResponse
        });

        return assistantResponse;
      } else {
        console.error(await response.json());
        throw new Error('Failed to get response from Groq API');
      }

    } catch (error) {
      console.error('Error in conversation:', error);
      throw error;
    }
  }

  getConversationHistory(): Message[] {
    return this.messages;
  }

  getFormattedConversation(): string {
    return this.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`)
      .join('\n\n');
  }

  clearConversation(): void {
    // Reset to initial state with system prompt and welcome message
    this.messages = [
      {
        role: 'system',
        content: `You are an AI assistant. Keep replies under 25 letters.`
      },
      {
        role: 'assistant',
        content: 'Hi! Need help?'
      }
    ];
  }
}

export default ConversationManager;
