$(document).ready(function () {
    // //Animate cover
    anime({
        targets: '#img',
        duration: 100,
        opacity: [0, 1],
        direction: 'normal',
        easing: 'easeInOutSine'
    });
    //Animate title
    anime({
        targets: '#title',
        duration: 1000,
        translateX: [-1000, 0],
        opacity: [0.1, 1],
        direction: 'normal',
        easing: 'easeInOutSine'
    });
    //Animate description
    anime({
        targets: '#bar',
        duration: 1000,
        translateY: [200, 0],
        opacity: [0.1, 1],
        direction: 'normal',
        easing: 'easeInOutSine'
    });
    //Animate topbar
    anime({
        targets: '#topbar',
        duration: 1000,
        translateY: [-200, 0],
        opacity: [0.1, 1],
        direction: 'normal',
        easing: 'easeInOutSine'
    });
});