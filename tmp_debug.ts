import { detectPanoptoFromLinks } from './core/transcripts/providers/panoptoProvider.ts';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('');
const parser = new dom.window.DOMParser();
const doc = parser.parseFromString(
  '<html><body><a href="https://learning.monash.edu/mod/url/view.php?id=4042871">Week 3 recording</a></body></html>',
  'text/html'
);
const videos = detectPanoptoFromLinks(doc);
console.log(videos);
