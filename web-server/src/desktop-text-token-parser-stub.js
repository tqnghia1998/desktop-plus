const TokenType = {
  Text: 0,
  Emoji: 1,
  Link: 2,
}

class Tokenizer {
  tokenize(text) {
    return text.length === 0 ? [] : [{ kind: TokenType.Text, text }]
  }
}

module.exports = { Tokenizer, TokenType }
