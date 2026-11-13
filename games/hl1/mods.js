zipMods = [
	['halva_en.zip', 'Half-Life (English)', 214283501, 21, 10485760]
];

pkgMods = [
];
var selectZip=document.getElementById('selectZip');
var iArgs=document.getElementById('iArgs');
selectZip.addEventListener('change', function(){
	if(selectZip.value=="halva_en.zip")
	{
		iArgs.value="-dev 1 -game valve";
	}
});
