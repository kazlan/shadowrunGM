angular.module('srtools').config(['$urlRouterProvider', '$stateProvider', '$locationProvider',
  function ($urlRouterProvider, $stateProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $stateProvider
      // LISTA DE CLIENTES CON SIDEPANEL
      .state('main',
        {
          url: '/',
          templateUrl: 'client/views/main.html',
          controller: 'tools'
        })
      .state('players/_id',
        {
          url: '/players/_id',
          templateUrl: 'client/view/detalle.html',
          controller: 'playerDetail'
        });
      // LOGIN SCREEN AND TOOLS
    $urlRouterProvider.otherwise("/");
  }
  ]);