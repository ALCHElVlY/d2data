'use strict'; /* global Vue */
Vue && Vue.directive('tooltip', {
  bind: function (el, binding) {
    if (binding.value) {
      el.setAttribute('data-tooltip', binding.value);
      el.classList.add('tw-tooltip');
    }
  },
});
