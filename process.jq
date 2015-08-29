def bi: . as $orig | range(length) | [$orig[.], .];

 . as $o | .objects[] | select(.type == "arc" and (.points | length) > 200)
 | [.name, (.points|length)]
