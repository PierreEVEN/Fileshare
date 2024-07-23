import {select_next_element, select_previous_element,} from "./repos_builder";
import {ItemCarousel} from "./item_carousel";
import {CarouselList} from "../components/carousel/carousel_list/carousel_list";
import {Carousel} from "../components/carousel/carousel";

let opened_item_div = null;
let overlay = null;
let last_item = null;

let tile = null;

let hide_overlay_timeout = null;

function show_overlay(time) {
    if (!overlay)
        return;
    overlay.classList.add('overlay-displayed');
    overlay.classList.remove('overlay-hidden');
    if (hide_overlay_timeout)
        clearTimeout(hide_overlay_timeout);
    hide_overlay_timeout = setTimeout(() => {
        if (!overlay)
            return;
        overlay.classList.remove('overlay-displayed');
        overlay.classList.add('overlay-hidden');
    }, time)
}

window.addEventListener('mousemove', _ => show_overlay(500));
window.addEventListener('click', _ => show_overlay(2000));

let touchstartX = 0
let touchendX = 0
let touchstartY = 0
let touchendY = 0

function checkDirection() {
    let changed = false;
    if (touchendY < touchstartY - window.screen.height / 4 || touchendY > touchstartY + window.screen.height / 4) {
        close_item_plain();
        changed = true;
    } else {
        if (touchendX < touchstartX - window.screen.width / 5) {
            select_previous_element();
            changed = true;
        }
        if (touchendX > touchstartX + window.screen.width / 5) {
            select_next_element();
            changed = true;
        }
    }
    if (changed) {
        touchstartX = touchendX;
        touchstartY = touchendY;
    }
}

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX
    touchstartY = e.changedTouches[0].screenY
})

document.addEventListener('touchmove', e => {

    touchendX = e.changedTouches[0].screenX
    touchendY = e.changedTouches[0].screenY
    if (e.changedTouches.length > 1) {
        touchstartX = touchendX;
        touchstartY = touchendY;
        return;
    }
    checkDirection()
})

window.addEventListener('resize', _ => {
    if (opened_item_div) {
        opened_item_div.style.width = window.innerWidth + 'px';
        opened_item_div.style.height = window.innerHeight + 'px';
    }
})

function close_item_plain() {
    last_item = null;
    if (opened_item_div)
        opened_item_div.remove();
    opened_item_div = null;

    if (!(document.fullScreenElement || (!document.mozFullScreen && !document.webkitIsFullScreen))) {
        if (document.cancelFullScreen) {
            document.cancelFullScreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        }
    }
}

function is_item_preview_open() {
    return !!opened_item_div;
}