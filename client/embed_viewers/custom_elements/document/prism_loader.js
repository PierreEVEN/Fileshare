import Prism from 'prismjs';
Prism.manual = true;
function load_element(element) {
    Prism.highlightAllUnder(element);
}

export {load_element}