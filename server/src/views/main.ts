import { h, VNode } from 'virtual-dom';
import * as fs from 'fs';

const clientMainJs = fs.readFileSync(`${__dirname}/../client/main.js`).toString();

const siteTitle = 'Simple TypeScript Blog';

export default ({ title, body }) => (
    h('html', [
        h('head', [
            h('meta', { charset: 'utf-8' }, []),
            h('title', `${title ? (title + ' – ') : ''}${siteTitle}`),
            h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }, [])
        ]),
        h('body', [
            h('h1', [
                h('a', { href: '/' }, siteTitle)
            ]),
            h('h3', 'Full-stack web developer'),
            h('div', [ body ]),
            h('script', { innerHTML: clientMainJs }, [])
        ])
    ])
);
