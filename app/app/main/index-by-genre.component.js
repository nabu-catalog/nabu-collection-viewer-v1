"use strict";

const { groupBy, orderBy } = require("lodash");
const _ = require("lodash");

module.exports = {
    template: require("./index-by-genre.component.html"),
    bindings: {
        collections: "<"
    },
    controller: Controller,
    controllerAs: "vm"
};

Controller.$inject = [];
function Controller() {
    var vm = this;

    vm.$onInit = init;
    vm.$onDestroy = destroy;

    function init() {}

    function destroy() {}
}
