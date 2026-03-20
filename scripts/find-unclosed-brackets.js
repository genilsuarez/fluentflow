#!/usr/bin/env node
import { readFileSync } from 'fs';

const file = 'public/data/c1/c1-reading-academic.json';
const data = JSON.parse(readFileSync(file, 'utf-8'));

for (let i = 0; i < data.sections.length; i++) {
  const sec = data.sections[i];
  const text = sec.content || '';
  const opens = (text.match(/</g) || []).length;
  const closes = (text.match(/>/g) || []).length;
  if (opens !== closes) {
    console.log(`Section ${i} "${sec.title}": < count=${opens}, > count=${closes}`);
    // Find the problematic area
    let balance = 0;
    for (let j = 0; j < text.length; j++) {
      if (text[j] === '<') balance++;
      if (text[j] === '>') balance--;
      if (balance < 0 || (j === text.length - 1 && balance !== 0)) {
        const start = Math.max(0, j - 40);
        const end = Math.min(text.length, j + 40);
        console.log(`  Near position ${j}: "...${text.slice(start, end)}..."`);
        break;
      }
    }
  }
}
