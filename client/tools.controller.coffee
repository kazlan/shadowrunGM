tools = ($scope, $meteor) ->
	$scope.chars = $meteor.collection Chars
	$scope.addNewChar = ()->
		console.log "lerele"

angular
	.module('srtools')
	.controller 'tools', ['$scope', '$meteor', tools]
	
