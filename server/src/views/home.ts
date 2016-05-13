import { h } from 'virtual-dom';
import mainView from './main';

import { Post } from '../models';

const createPost = (post: Post) => (
    h('li', [
        h('h3', [ h('a', { href: post.href }, post.title) ]),
        h('p', post.date.toDateString())
    ])
);

export default (posts: Array<Post>) => {
    const body = h('ul', posts.map(createPost));

    return mainView({ title: '', body });
};
