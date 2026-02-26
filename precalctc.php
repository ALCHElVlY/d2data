<?php

declare(strict_types=1);

/**
 * @file
 * Walk and flatten a TC tree, including unique/set/rare/magic factors.
 */

chdir(realpath(__DIR__));

define('TREASURECLASSEX', json_decode(file_get_contents('json/treasureclassex.json'), TRUE));
define('TREASURECLASSEXBASE', json_decode(file_get_contents('json/base/treasureclassex.json'), TRUE));

foreach ([
  'json/precalctc/' => ['simulations/', TREASURECLASSEX, 'dropsim'],
  'json/base/precalctc/' => ['simulations/base/', TREASURECLASSEXBASE, 'dropsimbase'],
] as $basepath => [$simulationpath, $treasureclassex, $simulator]) {
  print("Generating $basepath\n");

  foreach (glob($basepath . '*.{json,mjs}', GLOB_BRACE) as $file) {
    if (is_file($file) && $file[0] !== '.') {
      unlink($file);
    }
  }

  $index = [];

  foreach ($treasureclassex as $tc_name => $tc) {
    $precalc = [];

    foreach (glob($simulationpath . '*.json') as $file) {
      if (is_file($file) && $file[0] !== '.') {
        unlink($file);
      }
    }

    foreach ([1, 2, 3, 4, 5, 6, 7, 8] as $dropmodifier) {
      $tc_name_escaped = escapeshellarg($tc_name);
      passthru("./$simulator $tc_name_escaped $dropmodifier");
    }

    $totalruns = 0;

    foreach (glob($simulationpath . '*.json') as $file) {
      $data = json_decode(file_get_contents($file), TRUE);
      if ($data['tc'] !== $tc_name) {
        throw new Exception("Expected TC $tc_name but got " . $data['tc']);
      }

      if (
        !($data['runs'] ?? 0) ||
        !($data['drops'] ?? []) ||
        !($data['playermod'] ?? 0)
      ) {
        continue;
      }
  
      $playermod = $data['playermod'] - 1;
      $drops = $data['drops'];
      $precalc[$playermod] ??= [];
      $totalruns += $data['runs'];
  
      if ($drops) {
        foreach ($drops as $entry) {
          [$item, $count, $unique, $set, $rare, $magic] = $entry;
          $key = "$item|$magic|$rare|$set|$unique";

          $precalc[$playermod][$key] ??= [
            $item,
            0,
            0,
            0,
            0,
            0,
          ];

          $precalc[$playermod][$key][1] += $count;
        }
      }
    }
  
    if ($precalc) {
      foreach ($precalc as $playermod => $entries) {
        $precalc[$playermod] = array_values($precalc[$playermod]);

        foreach ($precalc[$playermod] as $i => $entry) {
          $precalc[$playermod][$i][1] /= $totalruns;
        }

        usort($precalc[$playermod], function ($a, $b) {
          $ret = $b[1] - $a[1];
          // $b[1] - $a[1] wasn't sorting correctly?
          return $ret > 0 ? 1 : ($ret < 0 ? -1 : 0);
        });
      }

      $filename = preg_replace('/[^a-z0-9() -_]\+/i', '_', $tc_name);
      $filename = trim($filename, '_- ');
      $index[$tc_name] = $filename . ".json";
      $filepath = $basepath . $filename . ".json";
  
      if (file_exists($filepath)) {
        throw new Exception("File $filepath already exists");
      }
  
      file_put_contents($filepath, json_encode($precalc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
  }

  if ($index) {
    file_put_contents($basepath . '_index.json', json_encode($index, JSON_PRETTY_PRINT));

    $module = '';
    $module_map = [];

    $i = 1;

    foreach ($index as $tc_name => $filename) {
      $variable = $module_map[$tc_name] = "json$i";
      $module .= "import $variable from './$filename' with { type: 'json' };\n";
      $i++;
    }

    $module .= "\nexport default {\n";

    foreach ($module_map as $tc_name => $variable) {
      $module .= "  '$tc_name': $variable,\n";
    }

    $module .= "}\n";

    file_put_contents($basepath . '_all.mjs', $module);
  }
}
