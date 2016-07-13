/// <reference path="../typings/main.d.ts" />
/// <reference path="../manual-typings/main.d.ts" />

// https://github.com/Microsoft/TypeScript/issues/3005
/// <reference path="../../node_modules/typescript/lib/lib.es6.d.ts" />

import * as http from 'http';
import * as fs from 'fs';
import * as express from 'express';
import * as compression from 'compression';
import treeToHTML = require('vdom-to-html');
import dateFormat = require('dateformat');
import slug = require('slug');
import { sortBy } from 'lodash';
import * as denodeify from 'denodeify';

import postView from './views/post';
import homeView from './views/home';
import errorView from './views/error';

import redirectTrailingSlashes from './redirect-trailing-slashes';

import { Post, PostJson } from './models';

const homeRegExp = /^\/$/;
const postPrefixRegExp = /^\/(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9-]+)/;
const postRegExp = new RegExp(postPrefixRegExp.source + /$/.source);

const log = (message: string) => {
    console.log(`${new Date().toISOString()} ${message}`);
};

process.on('uncaughtException', (error: Error) => {
    log(error.stack);
    process.exit(1);
});

const readFile = denodeify(fs.readFile);
const loadFile = (path: string): Promise<string> => readFile(path).then(buffer => buffer.toString());
const loadJsonFile = <A>(path: string): Promise<A> => loadFile(path).then(jsonString => JSON.parse(jsonString));
const postsDir = `${__dirname}/posts`;
const loadPost = (fileName: string): Promise<PostJson> => loadJsonFile<PostJson>(`${postsDir}/${fileName}`);

const readdir = denodeify(fs.readdir);
const postsPromise: Promise<Array<PostJson>> = (
    readdir(postsDir).then(fileNames => Promise.all(fileNames.map(loadPost)))
);
const postsMapPromise = postsPromise.then(posts => posts.reduce((acc, post) => {
    acc.set(getPostSlug(post), post);
    return acc;
}, new Map<string, PostJson>()));

const getPost = (year: string, month: string, date: string, title: string): Promise<PostJson> => (
    postsMapPromise.then(postsMap => postsMap.get(`${year}/${month}/${date}/${title}`))
);


const getPostSlug = (postJson: PostJson): string => (
    `${dateFormat(new Date(postJson.date), 'yyyy/mm/dd')}/${slug(postJson.title, { lower: true })}`
);

const app = express();
app.enable('strict routing');

// // Remember: order matters!

app.use(compression());

const secondsInAYear = 365 * 24 * 60 * 60;
const publicDir = `${__dirname}/client`;
app.use('/', express.static(publicDir, { maxAge: secondsInAYear * 1000 }));

const sortPostsByDateDesc = (posts: Array<Post>) => sortBy(posts, post => post.date).reverse();

const docType = '<!DOCTYPE html>';
const stringifyTree = (tree: VirtualDOM.VNode) => docType + treeToHTML(tree);

const siteRouter = express.Router({ strict: app.get('strict routing') });

const postJsonToPost = (postJson: PostJson): Post => (
    {
        title: postJson.title,
        date: new Date(postJson.date),
        body: postJson.body,
        href: `/${getPostSlug(postJson)}`
    }
);

//
// Site
//

// We cache pages but we must ensure old assets are available

siteRouter.use((req, res, next) => {
    if (req.accepts('html')) {
        next();
    } else {
        res.sendStatus(400);
    }
});

siteRouter.get(homeRegExp, (req, res, next) => (
    postsPromise
        .then(posts => sortPostsByDateDesc(posts.map(postJsonToPost)))
        .then(posts => {
            const response = stringifyTree(homeView(posts));
            res
                .set('Cache-Control', 'public, max-age=60')
                .send(response);
        })
        .catch(next)
));

siteRouter.get(postRegExp, (req, res, next) => {
    const { 0: year, 1: month, 2: date, 3: title } = req.params;
    getPost(year, month, date, title)
        .then(postJson => {
            if (postJson) {
                const post = postJsonToPost(postJson);
                const response = stringifyTree(postView(post));
                res
                    .set('Cache-Control', 'public, max-age=60')
                    .send(response);
            } else {
                next();
            }
        })
        .catch(next);
});

app.use(redirectTrailingSlashes);

siteRouter.use((req, res) => {
    const state = { statusCode: 404, message: http.STATUS_CODES[404] };
    const response = stringifyTree(errorView(state));
    res.status(404).send(response);
});

app.use('/', siteRouter);

app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    log(error.stack);
    res.sendStatus(500);
});

const isDev = app.settings.env === 'development';
const onListen = (server: http.Server) => {
    const { port } = server.address();

    log(`Server running on port ${port}`);
};

const httpServer = http.createServer(app);
httpServer.listen(process.env.PORT || 8080, () => onListen(httpServer));
