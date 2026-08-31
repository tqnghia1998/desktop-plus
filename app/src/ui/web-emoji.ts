import definitions from '../../../gemoji/db/emoji.json'
import { Emoji } from '../lib/emoji'

type EmojiDefinition = {
  readonly emoji?: string
  readonly aliases: ReadonlyArray<string>
  readonly description?: string
}

function emojiImagePath(alias: string) {
  return `/static/emoji/${alias}.png`
}

function unicodeImagePath(value: string) {
  const first = value.codePointAt(0)
  if (!first) return null
  let filename = first.toString(16).padStart(4, '0')
  const second = value.codePointAt(2)
  if (second && second !== 0xfe0f)
    filename += `-${second.toString(16).padStart(4, '0')}`
  return `/static/emoji/unicode/${filename}.png`
}

const webEmoji = new Map<string, Emoji>()

for (const definition of definitions as ReadonlyArray<EmojiDefinition>) {
  const url = definition.emoji
    ? unicodeImagePath(definition.emoji)
    : emojiImagePath(definition.aliases[0])
  if (!url) continue
  for (const alias of definition.aliases) {
    webEmoji.set(`:${alias}:`, {
      ...definition,
      url,
    })
  }
}

export default webEmoji
