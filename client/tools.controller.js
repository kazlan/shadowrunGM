(function () {
    'use strict';

    angular
        .module('srtools')
        .controller('tools', tools);

    tools.$inject = ['$scope', '$meteor'];

    function tools ($scope, $meteor){
        $scope.chars = $meteor.collection(Chars);
        $scope.addNewChar = function(){
            console.log("lerele");
        }
    }

}) ();
