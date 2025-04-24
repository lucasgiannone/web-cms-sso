<?php
function execInBackground($cmd)
{
    if (substr(php_uname(), 0, 7) == "Windows") {
        pclose(popen("start /B " . $cmd, "r"));
    } else {
        exec($cmd . " > /dev/null &");
    }
}

//Get feed.xml file time
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