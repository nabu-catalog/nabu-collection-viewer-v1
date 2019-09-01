"use strict";

const { isEmpty, keys, each } = require("lodash");

module.exports = {
    template: require("./view-media.component.html"),
    bindings: {},
    controller: Controller,
    controllerAs: "vm"
};

Controller.$inject = [
    "$state",
    "$rootScope",
    "dataService",
    "$timeout",
    "$location"
];
function Controller($state, $rootScope, dataService, $timeout, $location) {
    var vm = this;

    var broadcastListener;

    vm.$onInit = init;
    vm.$onDestroy = destroy;
    vm.previousItem = previousItem;
    vm.nextItem = nextItem;

    function init() {
        broadcastListener = $rootScope.$on("item data loaded", loadItem);
        vm.config = {
            current: 0,
            item: null,
            showItemInformation: false
        };
        loadItem();
    }

    function destroy() {
        broadcastListener();
    }

    function loadItem() {
        const collectionId = $state.params.collectionId;
        const itemId = $state.params.itemId;
        vm.showMedia = false;
        vm.loadingData = true;
        dataService.getItem(collectionId, itemId).then(processResponse);

        function processResponse(resp) {
            vm.loadingData = false;
            if (isEmpty(resp)) {
                return;
            }
            vm.item = resp;
            vm.totalItems = vm.item.audio.length;
            if (isEmpty(vm.item.audio)) {
                return $state.go("main");
            }

            vm.audio = vm.item.audio.map(m => m.name);

            if (!$state.params.audioId) {
                $location.search({});
                $state.go("main.audio.instance", { audioId: vm.audio[0] });
            }
            $timeout(() => {
                const audioId = $state.params.audioId;
                vm.config.current = vm.audio.indexOf(audioId);
                vm.config.item = vm.item.audio[vm.config.current];
            });
        }
    }

    function jump() {
        each(vm.audio, (item, idx) => {
            if (vm.config.current === idx) {
                $location.search({});
                vm.config.item = null;
                $timeout(() => {
                    vm.config.item = vm.item.audio[vm.config.current];
                    $state.go("main.audio.instance", { audioId: item });
                });
            }
        });
    }

    function nextItem() {
        if (vm.config.current === vm.item.audio.length - 1) {
            return;
        }
        vm.config.current += 1;
        jump();
    }

    function previousItem() {
        if (vm.config.current === 0) {
            return;
        }
        vm.config.current -= 1;
        jump();
    }
}
