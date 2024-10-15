import Prism from 'prismjs';

Prism.manual = true;

function build(element) {
    Prism.highlightAllUnder(element);
}

export {build}