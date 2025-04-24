<?php
// Adicionar cabeçalhos para permitir o acesso do iframe
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Security-Policy: default-src * self blob: data: gap:; style-src * self \'unsafe-inline\'; script-src * \'self\' \'unsafe-inline\' \'unsafe-eval\'; img-src * self data:; connect-src * self;');

function execInBackground($cmd)
{
    if (substr(php_uname(), 0, 7) == "Windows") {
        pclose(popen("start /B " . $cmd, "r"));
    } else {
        exec($cmd . " > /dev/null &");
    }
}

// Get feed.xml file time if exists
if (file_exists('feed.xml')) {
    $feedtime = filemtime('feed.xml');
    //Get current time
    $now = time();
    $hour = 1;
    $time = $hour * 60 * 60;
    //If feed.xml is older than 1 hour
    if ($now - $feedtime > $time) {
        //Get current working directory
        $cwd = getcwd();
        //Back two folders
        $cwd = substr($cwd, 0, strrpos($cwd, '\\'));
        $cwd = substr($cwd, 0, strrpos($cwd, '\\'));
        //This folder
        $current = getcwd();
        $command = $cwd . '\Python311\python.exe ' . $current . '\feed.py';
       //var_dump($command);
        execInBackground($command);
    }
} else {
    // Se o arquivo não existe, tenta executar o script para criá-lo
    $cwd = getcwd();
    $cwd = substr($cwd, 0, strrpos($cwd, '\\'));
    $cwd = substr($cwd, 0, strrpos($cwd, '\\'));
    $current = getcwd();
    $command = $cwd . '\Python311\python.exe ' . $current . '\feed.py';
    execInBackground($command);
}
?>
<!doctypehtml>
    <html lang="en">
    <meta charset="UTF-8">
    <meta content="IE=edge" http-equiv="X-UA-Compatible">
    <meta content="width=device-width,initial-scale=1" name="viewport">
    <title>Player MoneyTimes</title>
    <link href="./assets/style.css" rel="preload" as="style">
    <link href="./assets/jquery.min.js" rel="preload" as="script">
    <link href="./assets/anime.js" rel="preload" as="script">
    <link href="./favicon.ico" rel="shortcut icon" type="image/x-icon">
    <script src="./assets/anime.js"></script>
    <script src="./assets/jquery.min.js"></script>
    <link href="../default/assets/style.css" rel="stylesheet">
    <div id="scene-1"></div>

    <div id="title"></div>
    <div id="bar">
        <div id="content">
            <div id="description"></div>
        </div>
    </div>
    <script src="./assets/animeopt.js"></script>
    <script src="./assets/script.min.js"></script>